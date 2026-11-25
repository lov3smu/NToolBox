<template>
  <PageLayout tool-path="/system-tools">
    <div class="page-body devt-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('监听端口') }}</span>
          <span class="panel-hint">
            {{
              portsSource
                ? t('{p0} 个端口 · 来自 {p1}', { p0: filteredPorts.length, p1: portsSource })
                : t('读取本机正在监听的 TCP/UDP 端口')
            }}
          </span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-toolbar">
            <AppInput
              v-model="portFilter"
              class="sys-filter"
              type="text"
              :placeholder="t('筛选端口、地址或进程')"
              spellcheck="false"
            />
            <span class="devt-spacer" />
            <button class="btn btn-secondary" :disabled="portsLoading" @click="loadPorts">
              {{ portsLoading ? t('读取中…') : t('刷新') }}
            </button>
          </div>
          <div v-if="portsError" class="devt-error">{{ portsError }}</div>
          <EmptyState v-else-if="portsLoading && !ports.length" size="sm" :description="t('正在读取监听端口…')" />
          <EmptyState
            v-else-if="!filteredPorts.length"
            size="sm"
            :description="ports.length ? t('没有匹配的监听端口') : t('未发现监听端口')"
          />
          <div v-else class="sys-table-wrap">
            <table class="sys-table">
              <thead>
                <tr>
                  <th>{{ t('端口') }}</th>
                  <th>{{ t('协议') }}</th>
                  <th>{{ t('地址') }}</th>
                  <th>PID</th>
                  <th>{{ t('进程') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredPorts" :key="`${item.protocol}-${item.address}-${item.port}-${item.pid}`">
                  <td class="sys-port">{{ item.port }}</td>
                  <td>{{ item.protocol.toUpperCase() }}</td>
                  <td class="sys-address" :title="item.address">{{ item.address }}</td>
                  <td>{{ item.pid ?? '—' }}</td>
                  <td class="sys-process" :title="item.process">{{ item.process || t('未识别') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('SSL 证书检查') }}</span>
          <span class="panel-hint">{{ t('输入域名或 HTTPS 地址，检查证书有效期与信任链') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="sys-ssl-form">
            <label class="sys-field sys-field-host">
              <span class="field-label">{{ t('域名或地址') }}</span>
              <AppInput
                v-model="sslHost"
                type="text"
                :placeholder="t('例如 example.com 或 https://example.com')"
                spellcheck="false"
                @keyup.enter="checkSsl"
              />
            </label>
            <label class="sys-field sys-field-port">
              <span class="field-label">{{ t('端口') }}</span>
              <AppInput v-model.number="sslPort" type="number" min="1" max="65535" />
            </label>
            <label class="sys-field sys-field-sni">
              <span class="field-label">{{ t('SNI（可选）') }}</span>
              <AppInput v-model="sslServername" type="text" spellcheck="false" />
            </label>
            <button class="btn btn-primary" :disabled="sslLoading" @click="checkSsl">
              {{ sslLoading ? t('检查中…') : t('检查证书') }}
            </button>
          </div>

          <div v-if="sslError" class="devt-error">{{ sslError }}</div>
          <EmptyState v-else-if="sslLoading" size="sm" :description="t('正在建立 TLS 连接…')" />
          <div v-else-if="sslResult" class="sys-cert">
            <div class="sys-cert-head">
              <span class="sys-status" :class="`is-${sslStatus.tone}`">{{ t(sslStatus.label) }}</span>
              <span class="sys-cert-host">{{ sslResult.host }}:{{ sslResult.port }}</span>
              <span class="devt-spacer" />
              <CopyButton
                :text="certificateText"
                :label="t('复制详情')"
                :success-message="t('已复制证书信息')"
                variant="secondary"
                size="sm"
              />
            </div>
            <div class="sys-cert-grid">
              <div v-for="row in certificateRows" :key="row.label" class="sys-cert-row">
                <span class="sys-cert-label">{{ row.label }}</span>
                <span class="sys-cert-value" :class="{ 'is-mono': row.mono }">{{ row.value || '—' }}</span>
              </div>
            </div>
          </div>
          <EmptyState v-else size="sm" :description="t('尚未检查证书')" />
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { useToast } from '@/composables'
import { formatDateTime } from '@/utils/format'
import CopyButton from '@/components/CopyButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { systemPorts, systemSslCheck } from '@/api'
import { normalizeSslTarget } from '@shared/systemTools'
import { t } from '@/i18n'
import '@/styles/dev-tools.css'
import '@/styles/system-tools.css'
import AppInput from '@/components/AppInput.vue'

const { showError } = useToast()

const ports = ref([])
const portsLoading = ref(false)
const portsError = ref('')
const portsSource = ref('')
const portFilter = ref('')

const sslHost = ref('')
const sslPort = ref(443)
const sslServername = ref('')
const sslLoading = ref(false)
const sslResult = ref(null)
const sslError = ref('')

const filteredPorts = computed(() => {
  const keyword = portFilter.value.trim().toLowerCase()
  if (!keyword) return ports.value
  return ports.value.filter((item) => {
    return (
      String(item.port).includes(keyword) ||
      item.protocol.includes(keyword) ||
      item.address.toLowerCase().includes(keyword) ||
      item.process.toLowerCase().includes(keyword)
    )
  })
})

const sslStatus = computed(() => {
  const result = sslResult.value
  if (!result) return { label: '', tone: 'success' }
  if (result.daysRemaining !== null && result.daysRemaining < 0) return { label: '已过期', tone: 'danger' }
  if (!result.authorized) return { label: '不受信任', tone: 'warning' }
  if (result.daysRemaining !== null && result.daysRemaining <= 30) return { label: '即将过期', tone: 'warning' }
  return { label: '有效', tone: 'success' }
})

const certificateRows = computed(() => {
  const result = sslResult.value
  if (!result) return []
  return [
    { label: t('协议'), value: result.protocol },
    { label: t('主体'), value: result.subject },
    { label: t('颁发者'), value: result.issuer },
    { label: t('生效时间'), value: formatDateTime(result.validFrom) },
    { label: t('到期时间'), value: formatDateTime(result.validTo) },
    {
      label: t('剩余天数'),
      value: result.daysRemaining === null ? '—' : t('{p0} 天', { p0: result.daysRemaining })
    },
    { label: t('证书链'), value: t('{p0} 级', { p0: result.chainLength }) },
    { label: t('备用域名'), value: result.subjectAltName.replace(/DNS:/g, ' ').trim() },
    { label: t('系统校验'), value: result.authorized ? t('已通过系统校验') : result.authorizationError },
    { label: t('指纹 SHA-256'), value: result.fingerprint256, mono: true }
  ]
})

const certificateText = computed(() => {
  const result = sslResult.value
  if (!result) return ''
  const lines = certificateRows.value.map((row) => `${row.label}: ${row.value}`)
  return [`${result.host}:${result.port}`, ...lines].join('\n')
})

function portErrorText(code) {
  switch (code) {
    case 'command-unavailable':
      return t('当前系统缺少 ss/netstat/lsof 命令，无法读取端口信息')
    default:
      return t('读取端口信息失败')
  }
}

function sslErrorText(code) {
  switch (code) {
    case 'invalid-target':
      return t('地址或端口格式无效')
    case 'dns-not-found':
      return t('域名解析失败')
    case 'connection-refused':
      return t('连接被拒绝')
    case 'timeout':
      return t('连接超时')
    case 'connection-reset':
      return t('连接被重置')
    case 'certificate-invalid':
      return t('证书校验失败')
    case 'no-certificate':
      return t('未获取到证书')
    case 'read-failed':
      return t('读取证书失败')
    default:
      return t('检查失败，请稍后重试')
  }
}

async function loadPorts() {
  if (portsLoading.value) return
  portsLoading.value = true
  portsError.value = ''
  try {
    const result = await systemPorts()
    if (!result?.success) {
      ports.value = []
      portsSource.value = ''
      portsError.value = portErrorText(result?.error)
      return
    }
    ports.value = Array.isArray(result.items) ? result.items : []
    portsSource.value = result.source || ''
  } finally {
    portsLoading.value = false
  }
}

async function checkSsl() {
  if (sslLoading.value) return
  const target = normalizeSslTarget({
    host: sslHost.value,
    port: sslPort.value === '' || sslPort.value === null ? 443 : sslPort.value,
    servername: sslServername.value
  })
  if (!target) {
    showError(t('请输入有效的域名与端口'))
    return
  }
  sslLoading.value = true
  sslError.value = ''
  sslResult.value = null
  try {
    const result = await systemSslCheck(target)
    if (!result?.success) {
      sslError.value = sslErrorText(result?.error)
      showError(sslError.value)
      return
    }
    sslResult.value = result
  } finally {
    sslLoading.value = false
  }
}

onMounted(loadPorts)
</script>
