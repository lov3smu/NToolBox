<template>
  <div class="mcp-panel">
    <header class="mcp-panel-head">
      <div class="mcp-panel-title">
        <strong>{{ t('ext.connector.title') }}</strong>
        <span class="mcp-panel-tag" :class="{ configured: enabledCount > 0 }">
          {{ enabledCount }} 个启用 · {{ servers.length }} 个已配置
        </span>
      </div>
      <div class="mcp-panel-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading || refreshing || busy"
          @click="refreshStatus"
        >
          {{ loading || refreshing ? '检查中…' : '刷新状态' }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading || refreshing || busy"
          title="按已保存的配置重启连接器"
          @click="restart"
        >
          重启服务
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="saveAll">
          {{ busy ? '保存中…' : '保存连接器' }}
        </button>
      </div>
    </header>

    <p class="mcp-panel-hint">
      通过 stdio 启动 MCP 服务，工具以 mcp__服务名__工具名 注册给 AI 助手；调用需审批，返回内容按不可信数据标记。
    </p>

    <div v-if="loading" class="mcp-empty">正在读取连接器配置…</div>
    <div v-else-if="servers.length === 0" class="mcp-empty">
      <p>{{ t('ext.connector.empty') }}</p>
      <span>例如：npx -y @modelcontextprotocol/server-filesystem /path/to/dir</span>
    </div>

    <div v-for="(server, index) in servers" :key="server.key" class="mcp-server">
      <div class="mcp-server-head">
        <input
          v-model="server.name"
          class="input-field mcp-name"
          :placeholder="t('ext.connector.name')"
          spellcheck="false"
        />
        <label class="mcp-toggle">
          <input v-model="server.enabled" type="checkbox" class="switch" />
          <span>{{ server.enabled ? '启用' : '停用' }}</span>
        </label>
        <span v-if="server.status" class="mcp-status" :class="`is-${server.status}`">
          {{ statusLabel(server) }}
        </span>
        <div class="mcp-server-actions">
          <button type="button" class="btn btn-secondary" :disabled="Boolean(testingKey)" @click="testServer(server)">
            {{ testingKey === server.key ? t('ext.connector.testing') : t('ext.connector.test') }}
          </button>
          <button type="button" class="btn btn-danger" @click="removeServer(index)">删除</button>
        </div>
      </div>
      <input
        v-model="server.command"
        class="input-field"
        :placeholder="t('ext.connector.command')"
        spellcheck="false"
      />
      <textarea
        v-model="server.argsText"
        class="input-field mcp-input"
        rows="2"
        spellcheck="false"
        :placeholder="t('ext.connector.args')"
      ></textarea>
      <textarea
        v-model="server.envText"
        class="input-field mcp-input"
        rows="2"
        spellcheck="false"
        :placeholder="t('ext.connector.env')"
      ></textarea>
      <p v-if="server.error" class="mcp-error">{{ server.error }}</p>
      <p v-if="server.testMessage" class="mcp-test-result" :class="{ success: server.testSuccess }">
        {{ server.testMessage }}
      </p>
    </div>

    <button type="button" class="mcp-add" :disabled="servers.length >= 16" @click="addServer">
      {{ t('ext.connector.add') }}
    </button>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getConfig, mcpReload, mcpStatus, mcpTest, patchConfig } from '@/api'
import { useToast } from '@/composables'
import { MCP_SERVER_NAME_PATTERN, normalizeMcpServers } from '@shared/mcp'
import { t } from '@/i18n'
import Toast from '@/components/Toast.vue'

const { toastVisible, toastMessage, toastType, showSuccess, showError } = useToast()

const servers = ref([])
const loading = ref(true)
const refreshing = ref(false)
const busy = ref(false)
const testingKey = ref('')
let keySeed = 0

const enabledCount = computed(() => servers.value.filter((server) => server.enabled).length)

function createServer(server = {}) {
  keySeed += 1
  return {
    key: `mcp-${keySeed}`,
    name: server.name || '',
    command: server.command || '',
    argsText: Array.isArray(server.args) ? server.args.join('\n') : '',
    envText: Object.entries(server.env || {})
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
    enabled: server.enabled !== false,
    status: '',
    toolCount: 0,
    error: '',
    testMessage: '',
    testSuccess: false
  }
}

function statusLabel(server) {
  if (server.status === 'ready') return `已连接 · ${server.toolCount} 个工具`
  if (server.status === 'starting') return '连接中'
  if (server.status === 'disabled') return '未启用'
  if (server.status === 'error') return '连接失败'
  return '未连接'
}

function applyStatus(list) {
  const map = new Map((Array.isArray(list) ? list : []).map((item) => [item.name, item]))
  servers.value = servers.value.map((server) => {
    const live = map.get(server.name.trim().toLowerCase())
    if (!live) return { ...server, status: server.enabled ? '' : 'disabled', toolCount: 0, error: '' }
    return { ...server, status: live.status, toolCount: live.toolCount || 0, error: live.error || '' }
  })
}

async function load() {
  loading.value = true
  try {
    const config = await getConfig()
    servers.value = normalizeMcpServers(config?.mcp_servers).map((server) => createServer(server))
  } finally {
    loading.value = false
  }
  await refreshStatus()
}

async function refreshStatus() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    applyStatus(await mcpStatus())
  } finally {
    refreshing.value = false
  }
}

async function restart() {
  busy.value = true
  try {
    const result = await mcpReload()
    if (result?.success) showSuccess('MCP 服务已重载')
    else showError('部分连接器连接失败，请查看状态')
  } finally {
    busy.value = false
  }
  await refreshStatus()
}

function addServer() {
  if (servers.value.length >= 16) {
    showError('最多配置 16 个 MCP 连接器')
    return
  }
  servers.value.push(createServer())
}

function removeServer(index) {
  servers.value.splice(index, 1)
}

function serializeServer(server) {
  const name = server.name.trim().toLowerCase()
  const command = server.command.trim()
  if (!name && !command) return { skip: true }

  if (!MCP_SERVER_NAME_PATTERN.test(name)) {
    return { error: `连接器名称「${server.name}」无效：仅允许小写字母、数字和连字符` }
  }
  if (!command) return { error: `连接器 ${name} 缺少启动命令` }

  const args = server.argsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (args.length > 64) return { error: `连接器 ${name} 的参数过多（最多 64 个）` }

  const env = {}
  for (const line of server.envText.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    const separator = text.indexOf('=')
    const key = separator > 0 ? text.slice(0, separator).trim() : ''
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { error: `连接器 ${name} 的环境变量格式无效：${text}（应为 KEY=VALUE）` }
    }
    env[key] = text.slice(separator + 1).trim()
  }

  return { value: { name, command, args, env, enabled: server.enabled } }
}

async function saveAll() {
  if (busy.value) return
  const payload = []
  const seen = new Set()
  for (const server of servers.value) {
    const result = serializeServer(server)
    if (result.error) {
      showError(result.error)
      return
    }
    if (result.skip) continue
    if (seen.has(result.value.name)) {
      showError(`连接器名称重复：${result.value.name}`)
      return
    }
    seen.add(result.value.name)
    payload.push(result.value)
  }

  busy.value = true
  try {
    const ok = await patchConfig({ mcp_servers: payload })
    if (!ok) {
      showError('保存连接器配置失败')
      return
    }
    const reloaded = await mcpReload()
    if (reloaded?.success) showSuccess('连接器配置已保存并重载')
    else showError('配置已保存，但部分连接器连接失败')
    await refreshStatus()
  } finally {
    busy.value = false
  }
}

async function testServer(server) {
  if (testingKey.value) return
  const result = serializeServer(server)
  if (result.error) {
    server.testSuccess = false
    server.testMessage = result.error
    return
  }
  if (result.skip) {
    server.testSuccess = false
    server.testMessage = '请先填写服务名与启动命令'
    return
  }

  testingKey.value = server.key
  server.testMessage = ''
  try {
    const response = await mcpTest({ ...result.value, enabled: true })
    server.testSuccess = response?.success === true
    server.testMessage = response?.success
      ? t('ext.connector.testOk', { count: response.toolCount ?? 0 })
      : t('ext.connector.testFail', { error: response?.error || '未知错误' })
  } catch (error) {
    server.testSuccess = false
    server.testMessage = t('ext.connector.testFail', { error: error?.message || '未知错误' })
  } finally {
    testingKey.value = ''
  }
}

onMounted(load)
</script>

<style scoped>
.mcp-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mcp-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.mcp-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--font-size-md);
  color: var(--text-primary);
}

.mcp-panel-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  border: 1px solid var(--border-color);
}

.mcp-panel-tag.configured {
  color: var(--success-dark);
  border-color: rgba(var(--success-rgb), 0.35);
  background: rgba(var(--success-rgb), 0.1);
}

.mcp-panel-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mcp-panel-hint {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.mcp-empty {
  padding: 18px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mcp-empty p {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.mcp-empty span {
  color: var(--text-tertiary);
}

.mcp-server {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.mcp-server-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mcp-name {
  width: 220px;
  flex: 1 1 180px;
}

.mcp-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  white-space: nowrap;
}

.mcp-status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  border: 1px solid var(--border-color);
}

.mcp-status.is-ready {
  color: var(--success-dark);
  border-color: rgba(var(--success-rgb), 0.35);
  background: rgba(var(--success-rgb), 0.1);
}

.mcp-status.is-error {
  color: var(--error-dark);
  border-color: rgba(var(--error-rgb), 0.35);
  background: rgba(var(--error-rgb), 0.1);
}

.mcp-server-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.mcp-input {
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--font-size-dense);
}

.mcp-error {
  margin: 0;
  color: var(--error-dark);
  font-size: var(--font-size-sm);
}

.mcp-test-result {
  margin: 0;
  color: var(--error-dark);
  font-size: var(--font-size-sm);
}

.mcp-test-result.success {
  color: var(--success-dark);
}

.mcp-add {
  align-self: flex-start;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  padding: 7px 12px;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.16s ease;
}

.mcp-add:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.06);
}

.mcp-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
