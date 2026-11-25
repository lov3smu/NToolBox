<template>
  <div class="dialog dialog-conn-form">
    <div class="dialog-header">
      <h3>{{ t(title) }}</h3>
      <button class="btn-icon btn-sm" :title="t('关闭')" @click="$emit('close')">
        <AppIcon name="close" />
      </button>
    </div>
    <div class="conn-form-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="['conn-form-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ t(tab.label) }}
      </button>
    </div>
    <div class="dialog-content conn-form-body">
      <template v-if="activeTab === 'info'">
        <div v-if="!isSqlite" class="conn-row">
          <span class="conn-row-label">{{ t('URL（可选）') }}</span>
          <div class="conn-url-wrap">
            <AppInput
              v-model="urlText"
              type="text"
              class="input-field-inline"
              :placeholder="urlPlaceholder"
              @input="urlError = false"
              @keydown.enter.prevent="applyUrl"
            />
            <button type="button" class="btn-icon btn-sm" :title="t('解析并填充')" @click="applyUrl">
              <AppIcon name="link" />
            </button>
          </div>
        </div>
        <div v-if="urlError" class="dialog-alert error">{{ t('无法解析连接 URL') }}</div>
        <div class="conn-row">
          <span class="conn-row-label">{{ t('名称') }}</span>
          <AppInput
            v-model="connection.name"
            type="text"
            class="input-field-inline"
            :placeholder="t('连接名称，留空则自动生成')"
          />
        </div>
        <div class="conn-row">
          <span class="conn-row-label">{{ t('类型') }}</span>
          <button type="button" class="conn-type-button" @click="$emit('change-engine')">
            <EngineLogo :engine="connection.engine" size="xs" />
            <span>{{ engineInfo.label }}</span>
            <AppIcon name="edit" class="conn-type-pencil" />
          </button>
        </div>
        <div class="conn-row">
          <span class="conn-row-label">{{ t('颜色') }}</span>
          <div class="conn-color-row">
            <button
              v-for="color in COLOR_OPTIONS"
              :key="color || 'none'"
              type="button"
              :class="['conn-color-swatch', { none: !color, active: connection.color === color }]"
              :style="color ? { '--swatch-color': color } : null"
              :title="color || t('无颜色')"
              @click="connection.color = color"
            />
            <label :class="['conn-color-swatch', 'custom', { active: customColor }]" :title="t('自定义颜色')">
              <AppIcon name="edit" />
              <input v-model="connection.color" type="color" class="conn-color-input" />
            </label>
            <span class="conn-color-divider" />
            <span class="conn-inline-label">{{ t('分组') }}</span>
            <select v-model="connection.group" class="input-field-inline conn-group-select">
              <option value="">{{ t('默认') }}</option>
              <option v-for="group in groups" :key="group" :value="group">{{ group }}</option>
            </select>
          </div>
        </div>
        <div v-if="isSqlite" class="conn-row">
          <span class="conn-row-label">{{ t('数据库文件') }}</span>
          <div class="conn-file-row">
            <AppInput
              v-model="connection.filePath"
              type="text"
              class="input-field-inline"
              :placeholder="t('选择 SQLite 数据库文件')"
            />
            <button class="btn btn-secondary btn-sm" type="button" @click="browseSqliteFile">
              {{ t('浏览') }}
            </button>
          </div>
        </div>
        <template v-else>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('主机') }}</span>
            <div class="conn-inline-pair">
              <AppInput
                v-model="connection.host"
                type="text"
                class="input-field-inline"
                placeholder="localhost"
                @blur="applyDefaultHost"
              />
              <AppInput
                v-model="connection.port"
                type="number"
                class="input-field-inline conn-port"
                :placeholder="String(engineInfo.defaultPort)"
                @blur="applyDefaultPort"
              />
            </div>
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('用户名') }}</span>
            <AppInput
              v-model="connection.user"
              type="text"
              class="input-field-inline"
              :placeholder="engineInfo.defaultUser"
              @blur="applyDefaultUser"
            />
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('密码') }}</span>
            <div class="conn-password-wrap">
              <AppInput
                v-model="connection.password"
                :type="showPassword ? 'text' : 'password'"
                class="input-field-inline"
              />
              <button
                type="button"
                class="btn-icon btn-sm conn-password-toggle"
                :title="showPassword ? t('隐藏密码') : t('显示密码')"
                @click="showPassword = !showPassword"
              >
                <AppIcon :name="showPassword ? 'eye-off' : 'eye'" />
              </button>
            </div>
          </div>
          <div class="conn-row">
            <span />
            <div class="conn-check-row">
              <label class="checkbox-label-inline">
                <input v-model="connection.savePassword" type="checkbox" />
                <span>{{ t('保存密码') }}</span>
              </label>
              <span class="conn-info-icon" :title="t('密码将使用本机密钥加密保存')">
                <AppIcon name="info" />
              </span>
            </div>
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('数据库') }}</span>
            <AppInput v-model="connection.database" type="text" class="input-field-inline" :placeholder="t('可选')" />
          </div>
          <div v-if="connection.engine === 'postgres'" class="conn-row">
            <span class="conn-row-label">{{ t('模式（Schema）') }}</span>
            <AppInput v-model="connection.schema" type="text" class="input-field-inline" placeholder="public" />
          </div>
          <div v-if="connection.engine === 'mysql'" class="conn-row is-start">
            <span class="conn-row-label">{{ t('数据字符集（只读）') }}</span>
            <div class="conn-charset">
              <select v-model="connection.charset" class="input-field-inline conn-charset-select">
                <option value="">{{ t('默认') }}</option>
                <option value="utf8mb4">utf8mb4</option>
                <option value="utf8">utf8</option>
                <option value="latin1">latin1</option>
                <option value="gbk">gbk</option>
                <option value="gb2312">gb2312</option>
              </select>
              <p class="conn-field-hint">{{ t(CHARSET_HINT) }}</p>
            </div>
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('连接参数') }}</span>
            <div class="conn-params-row">
              <span>{{ t('默认') }}</span>
              <button type="button" class="conn-link" @click="activeTab = 'advanced'">{{ t('配置...') }}</button>
            </div>
          </div>
        </template>
      </template>
      <template v-else-if="activeTab === 'tls'">
        <div class="conn-row">
          <span class="conn-row-label">{{ t('TLS/SSL') }}</span>
          <div class="conn-field-stack">
            <label class="checkbox-label-inline">
              <input v-model="connection.ssl.enabled" type="checkbox" />
              <span>{{ t('启用 SSL') }}</span>
            </label>
          </div>
        </div>
        <template v-if="connection.ssl.enabled">
          <div class="conn-row">
            <span class="conn-row-label">{{ t('证书校验') }}</span>
            <div class="conn-field-stack">
              <label class="checkbox-label-inline">
                <input v-model="connection.ssl.verify" type="checkbox" />
                <span>{{ t('校验服务器证书') }}</span>
              </label>
              <p class="conn-field-hint">{{ t('关闭校验可连接自签名证书，但不再验证服务器身份') }}</p>
            </div>
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('CA 证书路径') }}</span>
            <AppInput
              v-model="connection.ssl.caPath"
              type="text"
              class="input-field-inline"
              :placeholder="t('留空使用系统信任库')"
            />
          </div>
        </template>
      </template>
      <template v-else-if="activeTab === 'tunnel'">
        <div class="conn-row">
          <span class="conn-row-label">{{ t('SSH 隧道') }}</span>
          <div class="conn-field-stack">
            <label class="checkbox-label-inline">
              <input v-model="connection.ssh.enabled" type="checkbox" />
              <span>{{ t('启用') }}</span>
            </label>
            <p class="conn-field-hint">{{ t('通过跳板机转发连接，使用系统 OpenSSH 客户端与密钥登录') }}</p>
          </div>
        </div>
        <template v-if="connection.ssh.enabled">
          <div class="conn-row">
            <span class="conn-row-label">{{ t('跳板机地址') }}</span>
            <AppInput
              v-model="connection.ssh.host"
              type="text"
              class="input-field-inline"
              placeholder="ssh.example.com"
            />
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('SSH 端口') }}</span>
            <AppInput v-model.number="connection.ssh.port" type="number" class="input-field-inline conn-number" />
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('SSH 用户名') }}</span>
            <AppInput v-model="connection.ssh.user" type="text" class="input-field-inline" placeholder="root" />
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('私钥路径') }}</span>
            <AppInput
              v-model="connection.ssh.keyPath"
              type="text"
              class="input-field-inline"
              :placeholder="t('留空使用默认密钥或 ssh-agent')"
            />
          </div>
        </template>
      </template>
      <template v-else>
        <template v-if="!isSqlite">
          <div class="conn-row">
            <span class="conn-row-label">{{ t('保持连接间隔（秒）') }}</span>
            <div class="conn-timeout-row">
              <label class="checkbox-label-inline">
                <input v-model="connection.enableKeepAlive" type="checkbox" />
                <span>{{ t('启用') }}</span>
              </label>
              <AppInput
                v-model="connection.keepAliveInterval"
                type="number"
                class="input-field-inline conn-number"
                :disabled="!connection.enableKeepAlive"
              />
            </div>
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('连接超时（秒）') }}</span>
            <div class="conn-timeout-row">
              <label class="checkbox-label-inline">
                <input v-model="connection.enableConnectTimeout" type="checkbox" />
                <span>{{ t('启用') }}</span>
              </label>
              <AppInput
                v-model="connection.connectTimeout"
                type="number"
                class="input-field-inline conn-number"
                :disabled="!connection.enableConnectTimeout"
              />
            </div>
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('读取超时（秒）') }}</span>
            <div class="conn-timeout-row">
              <label class="checkbox-label-inline">
                <input v-model="connection.enableReadTimeout" type="checkbox" />
                <span>{{ t('启用') }}</span>
              </label>
              <AppInput
                v-model="connection.readTimeout"
                type="number"
                class="input-field-inline conn-number"
                :disabled="!connection.enableReadTimeout"
              />
            </div>
          </div>
          <div class="conn-row">
            <span class="conn-row-label">{{ t('写入超时（秒）') }}</span>
            <div class="conn-timeout-row">
              <label class="checkbox-label-inline">
                <input v-model="connection.enableWriteTimeout" type="checkbox" />
                <span>{{ t('启用') }}</span>
              </label>
              <AppInput
                v-model="connection.writeTimeout"
                type="number"
                class="input-field-inline conn-number"
                :disabled="!connection.enableWriteTimeout"
              />
            </div>
          </div>
        </template>
        <div class="conn-row">
          <span class="conn-row-label">{{ t('自动连接') }}</span>
          <label class="checkbox-label-inline">
            <input v-model="connection.autoConnect" type="checkbox" />
            <span>{{ t('启动时自动连接') }}</span>
          </label>
        </div>
        <div class="conn-row is-start">
          <span class="conn-row-label">{{ t('只读连接') }}</span>
          <div class="conn-field-stack">
            <label class="checkbox-label-inline">
              <input v-model="connection.readOnly" type="checkbox" />
              <span>{{ t('启用') }}</span>
            </label>
            <p class="conn-field-hint">{{ t('只读连接禁止执行写入与结构变更，查询与状态面板不受影响') }}</p>
          </div>
        </div>
      </template>
    </div>
    <div v-if="mode === 'create'" class="dialog-footer conn-form-footer">
      <button class="btn btn-secondary conn-back" :disabled="busy" @click="$emit('back')">
        <AppIcon name="arrow-left" />
        <span>{{ t('上一步') }}</span>
      </button>
      <div class="conn-footer-actions">
        <button class="btn btn-secondary" disabled :title="t('连接后可选择显示的数据库')">
          {{ t('选择显示数据库') }}
        </button>
        <button class="btn btn-secondary" :disabled="busy" @click="$emit('test')">
          {{ busy ? t('测试中...') : t('测试') }}
        </button>
        <button class="btn btn-primary" :disabled="busy" @click="$emit('submit')">{{ t('保存并连接') }}</button>
      </div>
    </div>
    <div v-else class="dialog-footer">
      <div class="dialog-footer-left">
        <button class="btn btn-secondary" :disabled="busy" @click="$emit('test')">
          {{ busy ? t('测试中...') : t('测试连接') }}
        </button>
      </div>
      <div class="dialog-footer-right">
        <button class="btn btn-secondary" :disabled="busy" @click="$emit('close')">{{ t('取消') }}</button>
        <button class="btn btn-primary" :disabled="busy" @click="$emit('submit')">{{ t('保存') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { dbSelectSqliteFile } from '@/api'
import { ENGINE_INFO } from '@shared/databaseEngines'
import { parseConnectionUrl } from '../connectionUrl'
import { applyEngineDefaults } from '../connectionDefaults'

import AppIcon from '@/components/AppIcon.vue'
import EngineLogo from './EngineLogo.vue'
import AppInput from '@/components/AppInput.vue'

defineProps({
  title: { type: String, required: true },
  mode: { type: String, default: 'create' },
  busy: { type: Boolean, default: false },
  groups: { type: Array, default: () => [] }
})

defineEmits(['close', 'back', 'change-engine', 'test', 'submit'])

const connection = defineModel({ type: Object, required: true })

const COLOR_OPTIONS = ['', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6']
const CHARSET_HINT =
  '适用于 latin1 文本列中存放的 GBK/GB18030/BIG5 遗留字节。要求默认或显式 charset=utf8mb4 会话。这不是自动识别：正常西文可能被重新解释；解码失败时保留原文本。'

const activeTab = ref('info')
const showPassword = ref(false)
const urlText = ref('')
const urlError = ref(false)

const engineInfo = computed(() => ENGINE_INFO[connection.value.engine] || ENGINE_INFO.mysql)
const isSqlite = computed(() => engineInfo.value.fileBased === true)
const customColor = computed(() => Boolean(connection.value.color) && !COLOR_OPTIONS.includes(connection.value.color))
const urlPlaceholder = computed(() =>
  isSqlite.value ? '' : `${connection.value.engine}://user:password@host:port/database`
)

const tabs = computed(() => [
  { id: 'info', label: '连接信息' },
  ...(isSqlite.value
    ? []
    : [
        { id: 'tls', label: 'TLS/SSL' },
        { id: 'tunnel', label: '隧道/代理' }
      ]),
  { id: 'advanced', label: '高级' }
])

watch(isSqlite, (fileBased) => {
  if (fileBased && (activeTab.value === 'tls' || activeTab.value === 'tunnel')) activeTab.value = 'info'
})

function applyDefaultHost() {
  if (!String(connection.value.host || '').trim()) connection.value.host = 'localhost'
}

function applyDefaultPort() {
  if (!Number(connection.value.port)) connection.value.port = engineInfo.value.defaultPort
}

function applyDefaultUser() {
  if (!String(connection.value.user || '').trim()) connection.value.user = engineInfo.value.defaultUser
}

function applyUrl() {
  const parsed = parseConnectionUrl(urlText.value)
  if (!parsed) {
    urlError.value = true
    return
  }
  urlError.value = false
  const target = connection.value
  const previousEngine = target.engine
  if (parsed.engine !== previousEngine) {
    target.engine = parsed.engine
    applyEngineDefaults(target, previousEngine)
  }
  if (parsed.filePath) target.filePath = parsed.filePath
  if (parsed.host) target.host = parsed.host
  if (parsed.port) target.port = parsed.port
  if (parsed.user) target.user = parsed.user
  if (parsed.password) target.password = parsed.password
  if (parsed.database) {
    target.database = parsed.database
    if (!String(target.name || '').trim()) target.name = parsed.database
  }
}

async function browseSqliteFile() {
  const result = await dbSelectSqliteFile()
  if (result.canceled || !result.filePath) return
  connection.value.filePath = result.filePath
  if (!String(connection.value.name || '').trim()) {
    const fileName = result.filePath.split(/[\\/]/).pop() || ''
    connection.value.name = fileName.replace(/\.(sqlite3?|db3?)$/i, '')
  }
}
</script>

<style scoped>
.dialog-conn-form {
  width: 680px;
  height: min(780px, calc(100vh - 64px));
}

.conn-form-tabs {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
}

.conn-form-tab {
  height: 30px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.conn-form-tab:hover {
  color: var(--text-primary);
}

.conn-form-tab.active {
  background: var(--surface-muted);
  border-color: var(--border-color);
  color: var(--text-primary);
  font-weight: 500;
}

.conn-form-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 14px;
  overflow-y: auto;
}

.conn-form-body > .dialog-alert {
  margin-left: 116px;
}

.conn-row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.conn-row.is-start {
  align-items: start;
}

.conn-row-label {
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--text-secondary);
}

.conn-inline-label {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.conn-url-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.conn-url-wrap .input-field-inline {
  flex: 1;
  min-width: 0;
}

.conn-inline-pair {
  display: flex;
  gap: 8px;
}

.conn-inline-pair .input-field-inline {
  flex: 1;
  min-width: 0;
}

.conn-port,
.conn-number {
  flex: none;
  width: 104px;
}

.conn-type-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: var(--control-height);
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.conn-type-button:hover {
  border-color: var(--border-strong);
}

.conn-type-pencil {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--text-tertiary);
}

.conn-color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.conn-color-swatch {
  position: relative;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--swatch-color, var(--surface));
  cursor: pointer;
}

.conn-color-swatch.none {
  background:
    linear-gradient(135deg, transparent 46%, var(--text-tertiary) 46%, var(--text-tertiary) 54%, transparent 54%),
    var(--surface);
}

.conn-color-swatch.active {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 3px var(--accent-color);
}

.conn-color-swatch.custom {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--text-secondary);
}

.conn-color-swatch.custom svg {
  width: 12px;
  height: 12px;
  pointer-events: none;
}

.conn-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  opacity: 0;
  cursor: pointer;
}

.conn-color-divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--border-color);
}

.conn-group-select {
  flex: none;
  width: 140px;
}

.conn-file-row {
  display: flex;
  gap: 8px;
}

.conn-file-row .input-field-inline {
  flex: 1;
  min-width: 0;
}

.conn-password-wrap {
  position: relative;
}

.conn-password-wrap .input-field-inline {
  padding-right: 34px;
}

.conn-password-toggle {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
}

.conn-check-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.conn-info-icon {
  display: inline-flex;
  color: var(--text-tertiary);
}

.conn-info-icon svg {
  width: 14px;
  height: 14px;
}

.conn-field-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.conn-field-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--text-tertiary);
}

.conn-charset {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.conn-charset-select {
  width: 120px;
}

.conn-params-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: var(--control-height);
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.conn-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-color);
  font-family: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.conn-timeout-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-footer.conn-form-footer {
  justify-content: space-between;
}

.conn-footer-actions {
  display: flex;
  gap: 8px;
}

.conn-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.conn-back svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 760px) {
  .conn-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .conn-form-body > .dialog-alert {
    margin-left: 0;
  }

  .conn-row-label {
    font-size: var(--font-size-xs);
  }
}
</style>
