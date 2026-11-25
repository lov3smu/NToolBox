<template>
  <div class="mcp-panel">
    <header class="mcp-panel-head">
      <div class="mcp-panel-title">
        <strong>{{ t('MCP 连接器') }}</strong>
        <span class="mcp-panel-tag" :class="{ configured: enabledCount > 0 }">
          {{ t('{enabled} 个启用 · {total} 个已配置', { enabled: enabledCount, total: servers.length }) }}
        </span>
      </div>
      <div class="mcp-panel-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading || refreshing || busy"
          @click="refreshStatus"
        >
          {{ loading || refreshing ? t('检查中…') : t('刷新状态') }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading || refreshing || busy"
          :title="t('按已保存的配置重启连接器')"
          @click="restart"
        >
          {{ t('重启服务') }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="saveAll">
          {{ busy ? t('保存中…') : t('保存连接器') }}
        </button>
      </div>
    </header>

    <p class="mcp-panel-hint">
      {{
        t('通过 stdio 启动 MCP 服务，工具以 mcp__服务名__工具名 注册给 AI 助手；调用需审批，返回内容按不可信数据标记。')
      }}
    </p>

    <div class="mcp-presets">
      <span class="mcp-presets-label">{{ t('常用连接器') }}</span>
      <button type="button" class="mcp-preset" :disabled="busy" @click="addPreset('slack')">Slack</button>
      <button type="button" class="mcp-preset" :disabled="busy" @click="addPreset('mail')">
        {{ t('邮件 IMAP/SMTP') }}
      </button>
    </div>

    <div v-if="loading" class="mcp-empty">{{ t('正在读取连接器配置…') }}</div>
    <div v-else-if="servers.length === 0" class="mcp-empty">
      <p>{{ t('尚未配置任何 MCP 连接器') }}</p>
      <span>{{ t('例如：npx -y @modelcontextprotocol/server-filesystem /path/to/dir') }}</span>
    </div>

    <article v-for="(server, index) in servers" :key="server.key" class="mcp-server">
      <div class="mcp-server-head">
        <span class="mcp-icon" aria-hidden="true">
          <AppIcon name="plug" />
        </span>
        <div class="mcp-server-title">
          <AppInput v-model="server.name" class="mcp-name" :placeholder="t('连接器名称')" spellcheck="false" />
          <span v-if="server.status" class="mcp-status" :class="`is-${server.status}`">
            {{ statusLabel(server) }}
          </span>
        </div>
        <label class="mcp-toggle">
          <input v-model="server.enabled" type="checkbox" class="switch" />
          <span>{{ server.enabled ? t('启用') : t('停用') }}</span>
        </label>
      </div>
      <AppInput
        v-model="server.command"
        :placeholder="t('启动命令，如 npx（也可填完整命令行，保存时自动拆分）')"
        spellcheck="false"
      />
      <AppTextarea
        v-model="server.argsText"
        class="mcp-input"
        rows="2"
        spellcheck="false"
        :placeholder="t('参数，每行一个')"
      />
      <AppTextarea
        v-model="server.envText"
        class="mcp-input"
        rows="2"
        spellcheck="false"
        :placeholder="t('环境变量，每行一个 KEY=VALUE')"
      />
      <p v-if="server.error" class="mcp-error">{{ server.error }}</p>
      <p v-if="server.testMessage" class="mcp-test-result" :class="{ success: server.testSuccess }">
        {{ server.testMessage }}
      </p>
      <div class="mcp-server-actions">
        <button type="button" class="btn btn-secondary" :disabled="Boolean(testingKey)" @click="testServer(server)">
          {{ testingKey === server.key ? t('测试中…') : t('测试') }}
        </button>
        <button type="button" class="btn btn-danger" @click="removeServer(index)">{{ t('删除') }}</button>
      </div>
    </article>

    <button type="button" class="mcp-add" :disabled="servers.length >= 16" @click="addServer">
      {{ t('+ 添加连接器') }}
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getConfig, mcpReload, mcpStatus, mcpTest, patchConfig } from '@/api'
import AppIcon from '@/components/AppIcon.vue'
import { useToast } from '@/composables'
import { MCP_SERVER_NAME_PATTERN, normalizeMcpServers, splitCommandLine } from '@shared/mcp'
import { t } from '@/i18n'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'

const { showSuccess, showError } = useToast()

const servers = ref([])
const loading = ref(true)
const refreshing = ref(false)
const busy = ref(false)
const testingKey = ref('')
let keySeed = 0

const enabledCount = computed(() => servers.value.filter((server) => server.enabled).length)

const PRESETS = {
  slack: {
    name: 'slack',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' }
  },
  mail: {
    name: 'mail',
    command: 'npx',
    args: ['-y', 'mcp-mail-server'],
    env: {
      IMAP_HOST: '',
      IMAP_PORT: '993',
      IMAP_SECURE: 'true',
      SMTP_HOST: '',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      EMAIL_USER: '',
      EMAIL_PASS: ''
    }
  }
}

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
  if (server.status === 'ready') return t('已连接 · {count} 个工具', { count: server.toolCount })
  if (server.status === 'starting') return t('连接中')
  if (server.status === 'disabled') return t('未启用')
  if (server.status === 'error') return t('连接失败')
  return t('未连接')
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
    servers.value = normalizeMcpServers(config?.extensions.mcp_servers).map((server) => createServer(server))
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
    if (result?.success) showSuccess(t('MCP 服务已重载'))
    else showError(t('部分连接器连接失败，请查看状态'))
  } finally {
    busy.value = false
  }
  await refreshStatus()
}

function addServer() {
  if (servers.value.length >= 16) {
    showError(t('最多配置 16 个 MCP 连接器'))
    return
  }
  servers.value.push(createServer())
}

function addPreset(key) {
  const preset = PRESETS[key]
  if (!preset) return
  if (servers.value.some((server) => server.name.trim().toLowerCase() === preset.name)) {
    showError(t('该连接器已存在：{name}', { name: preset.name }))
    return
  }
  if (servers.value.length >= 16) {
    showError(t('最多配置 16 个 MCP 连接器'))
    return
  }
  servers.value.push(createServer(preset))
}

function removeServer(index) {
  servers.value.splice(index, 1)
}

function serializeServer(server) {
  const name = server.name.trim().toLowerCase()
  const split = splitCommandLine(server.command)
  const command = split.command
  if (!name && !command) return { skip: true }

  if (!MCP_SERVER_NAME_PATTERN.test(name)) {
    return { error: t('连接器名称「{name}」无效：仅允许小写字母、数字和连字符', { name: server.name }) }
  }
  if (!command) return { error: t('连接器 {name} 缺少启动命令', { name }) }

  const args = [
    ...split.args,
    ...server.argsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  ]
  if (args.length > 64) return { error: t('连接器 {name} 的参数过多（最多 64 个）', { name }) }

  const env = {}
  for (const line of server.envText.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    const separator = text.indexOf('=')
    const key = separator > 0 ? text.slice(0, separator).trim() : ''
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { error: t('连接器 {name} 的环境变量格式无效：{text}（应为 KEY=VALUE）', { name, text }) }
    }
    env[key] = text.slice(separator + 1).trim()
  }

  if (split.args.length) {
    server.command = command
    server.argsText = args.join('\n')
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
      showError(t('连接器名称重复：{name}', { name: result.value.name }))
      return
    }
    seen.add(result.value.name)
    payload.push(result.value)
  }

  busy.value = true
  try {
    const ok = await patchConfig({ extensions: { mcp_servers: payload } })
    if (!ok) {
      showError(t('保存连接器配置失败'))
      return
    }
    const reloaded = await mcpReload()
    if (reloaded?.success) showSuccess(t('连接器配置已保存并重载'))
    else showError(t('配置已保存，但部分连接器连接失败'))
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
    server.testMessage = t('请先填写服务名与启动命令')
    return
  }

  testingKey.value = server.key
  server.testMessage = ''
  try {
    const response = await mcpTest({ ...result.value, enabled: true })
    server.testSuccess = response?.success === true
    server.testMessage = response?.success
      ? t('连接成功，发现 {count} 个工具', { count: response.toolCount ?? 0 })
      : t('连接失败：{error}', { error: response?.error || t('未知错误') })
  } catch (error) {
    server.testSuccess = false
    server.testMessage = t('连接失败：{error}', { error: error?.message || t('未知错误') })
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
  border-radius: var(--radius-pill);
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

.mcp-presets {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mcp-presets-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.mcp-preset {
  padding: 4px 10px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all 0.16s ease;
}

.mcp-preset:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.06);
}

.mcp-preset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition: var(--transition-fast);
}

.mcp-server:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  box-shadow: var(--shadow-md);
}

.mcp-server-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mcp-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--accent-color);
}

.mcp-icon svg {
  width: 18px;
  height: 18px;
}

.mcp-server-title {
  flex: 1;
  min-width: 200px;
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
  border-radius: var(--radius-pill);
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
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
}

.mcp-input {
  resize: vertical;
  font-family: var(--font-mono);
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
