<template>
  <PageLayout tool-path="/sql-generator">
    <div class="page-body">
      <div class="generator-grid">
        <section class="panel form-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('脚本信息') }}</span>
            <span class="panel-hint">{{ t('填写后生成规范编号的 SQL 文件') }}</span>
          </div>
          <div class="panel-body">
            <div class="mode-options" role="tablist" :aria-label="t('脚本操作类型')">
              <button
                v-for="mode in operateTabs"
                :key="mode.key"
                type="button"
                role="tab"
                class="mode-option"
                :class="{ active: mode.key === operateType }"
                :aria-selected="mode.key === operateType"
                @click="setOperateType(mode.key)"
              >
                <span class="mode-option-label">{{ mode.label }}</span>
                <span class="mode-option-desc">{{ t(mode.desc) }}</span>
              </button>
            </div>

            <div class="form-grid">
              <div class="field field-wide">
                <label>{{ t('脚本用途') }}</label>
                <input
                  v-model="usage"
                  type="text"
                  :placeholder="t('请输入脚本用途')"
                  class="input-field"
                  @input="handleUsageInput"
                />
                <span class="field-hint">{{ t('用于生成文件名与脚本历史记录备注') }}</span>
              </div>

              <div class="field" :class="{ 'field-wide': operateType === 'QUERY' }">
                <label>{{ t('数据库') }}</label>
                <select v-model="database" class="select-field">
                  <option value="">{{ t('请选择数据库') }}</option>
                  <option v-for="db in databases" :key="db" :value="db">
                    {{ db }}
                  </option>
                </select>
              </div>

              <div v-if="operateType !== 'QUERY'" class="field">
                <label>{{ t('脚本类型') }}</label>
                <select v-model="scriptType" class="select-field">
                  <option value="">{{ t('请选择脚本类型') }}</option>
                  <option v-for="type in scriptTypes" :key="type.name" :value="type.name">
                    {{ type.name }}
                  </option>
                </select>
                <span class="field-hint">{{ t(selectedScriptTypeDesc) }}</span>
              </div>

              <div class="field field-wide">
                <label>{{ t('目录名') }}</label>
                <div class="dir-name-row">
                  <input
                    v-model="dirName"
                    type="text"
                    :placeholder="t('留空自动生成')"
                    class="input-field"
                    @input="handleDirNameInput"
                  />
                </div>
                <div v-if="lastDirName" class="dir-name-extra">
                  <span class="dir-name-last" :title="lastDirName">{{ t('上次：{name}', { name: lastDirName }) }}</span>
                  <label class="dir-name-option" :class="{ active: useLastDirName }">
                    <input type="checkbox" :checked="useLastDirName" @change="toggleUseLastDirName" />
                    <span class="dir-name-option-track" aria-hidden="true">
                      <span class="dir-name-option-thumb" />
                    </span>
                    <span>{{ t('使用上次目录') }}</span>
                  </label>
                </div>
                <span class="field-hint">{{ t('可自定义目录名，或开启开关复用上次生成的目录') }}</span>
              </div>
            </div>

            <div class="form-footer">
              <span class="form-footer-hint" :title="previewPath">{{ previewPath }}</span>
              <button class="btn btn-primary sql-generate-btn" :disabled="loading" @click="generate">
                <span v-if="loading" class="generate-spinner" aria-hidden="true" />
                {{ loading ? t('生成中...') : t('生成脚本') }}
              </button>
            </div>
          </div>
        </section>

        <aside class="panel preview-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('输出预览') }}</span>
            <span class="preview-badge">{{ t('实时') }}</span>
          </div>
          <div class="panel-body">
            <div class="preview-path">
              <template v-for="(segment, index) in previewSegments" :key="`${segment.label}-${index}`">
                <span v-if="index" class="preview-sep">/</span>
                <span class="preview-segment" :class="{ auto: segment.auto }">{{ segment.label }}</span>
              </template>
            </div>

            <div class="preview-meta">
              <div class="preview-item">
                <span class="preview-dot" />
                <span
                  >{{ t('目录名留空时按') }} <code>{{ t('MMDD-用途') }}</code> {{ t('自动生成') }}</span
                >
              </div>
              <div class="preview-item">
                <span class="preview-dot" />
                <span>{{ t('文件名按') }} <code>S01</code>、<code>S02</code> {{ t('自动编号') }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-dot" />
                <span>{{ t('自动追加') }} <code>t_script_history</code> {{ t('记录') }}</span>
              </div>
            </div>

            <div class="preview-root">
              <div class="preview-root-label">{{ t('脚本根目录') }}</div>
              <div class="preview-root-value" :title="config?.sql_generator.base_path || ''">
                {{ config?.sql_generator.base_path || t('未配置脚本根目录') }}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section v-if="result" class="panel result-panel" :class="result.success ? 'is-success' : 'is-error'">
        <div class="panel-header">
          <span class="panel-title">{{ t('生成结果') }}</span>
          <span class="result-badge" :class="result.success ? 'success' : 'error'">
            {{ result.success ? t('成功') : t('失败') }}
          </span>
        </div>
        <div class="panel-body">
          <template v-if="result.success">
            <div class="result-summary">
              <span class="result-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <div class="result-copy">
                <div class="result-message success">{{ t('脚本生成成功') }}</div>
                <div class="result-sub">{{ t('可打开文件继续补充 SQL 语句') }}</div>
              </div>
            </div>

            <div class="result-details">
              <div class="result-row">
                <span class="result-label">{{ t('文件名') }}</span>
                <span class="result-value">{{ result.filename }}</span>
              </div>
              <div class="result-row">
                <span class="result-label">{{ t('文件路径') }}</span>
                <code>{{ result.filePath }}</code>
              </div>
            </div>

            <div class="result-actions">
              <button class="btn btn-primary btn-sm" @click="openFile">{{ t('打开文件') }}</button>
              <button class="btn btn-secondary btn-sm" @click="openFolder">{{ t('打开文件夹') }}</button>
            </div>
          </template>

          <div v-else class="result-summary">
            <span class="result-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" stroke-linecap="round" />
              </svg>
            </span>
            <div class="result-copy">
              <div class="result-message error">{{ t('生成失败') }}</div>
              <div class="result-sub">{{ result.error || t('请检查填写内容后重试') }}</div>
            </div>
          </div>
        </div>
      </section>

      <ScriptManager
        ref="scriptManagerRef"
        class="script-manager-panel"
        :root-path="config?.sql_generator.base_path || ''"
      />
    </div>
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAutoDirName, useConfig } from '@/composables'
import PageLayout from '@/layouts/PageLayout.vue'
import ScriptManager from '@/components/ScriptManager.vue'
import { joinPath } from '@/utils/path'
import { generateScript, openFile as apiOpenFile, openFolder as apiOpenFolder } from '@/api'
import { t } from '@/i18n'

const LAST_DIR_NAME_KEY = 'sqlGeneratorLastDirName'

const { config } = useConfig()
const usage = ref('')
const { dirName, updateDirName } = useAutoDirName(usage)
const lastDirName = ref((localStorage.getItem(LAST_DIR_NAME_KEY) || '').trim())
const useLastDirName = ref(false)

const operateTabs = [
  {
    key: 'FIX',
    label: 'FIX',
    get desc() {
      return t('修复脚本')
    },
    root: 'PRODUCT-FIX'
  },
  {
    key: 'PUBLISH',
    label: 'PUBLISH',
    get desc() {
      return t('发布脚本')
    },
    root: 'PUBLISH'
  },
  {
    key: 'QUERY',
    label: 'QUERY',
    get desc() {
      return t('查询脚本')
    },
    root: 'DATA-QUERY'
  }
]

const operateType = ref('PUBLISH')
const database = ref('')
const scriptType = ref('')
const loading = ref(false)
const result = ref(null)
const scriptManagerRef = ref(null)

const databases = computed(() => config.value?.sql_generator.databases || [])
const scriptTypes = computed(() => config.value?.sql_generator.script_types || [])
const currentMode = computed(() => operateTabs.find((mode) => mode.key === operateType.value) || operateTabs[1])
const selectedScriptTypeDesc = computed(
  () => scriptTypes.value.find((type) => type.name === scriptType.value)?.description || t('决定脚本存放的子目录')
)
const previewSegments = computed(() => {
  const segments = [
    { label: currentMode.value.root },
    { label: String(new Date().getFullYear()) },
    dirName.value.trim()
      ? { label: dirName.value.trim() }
      : {
          get label() {
            return t('MMDD-用途')
          },
          auto: true
        }
  ]
  if (operateType.value !== 'QUERY' && scriptType.value) {
    segments.push({ label: scriptType.value })
  }
  return segments
})
const previewPath = computed(() => {
  const parts = previewSegments.value.map((segment) => segment.label)
  return config.value?.sql_generator.base_path
    ? joinPath(config.value.sql_generator.base_path, parts)
    : parts.join(' / ')
})

function setOperateType(type) {
  operateType.value = type
  if (!useLastDirName.value) updateDirName(true)
}

async function generate() {
  if (!usage.value.trim()) {
    result.value = { success: false, error: t('请输入脚本用途') }
    return
  }
  if (!database.value) {
    result.value = { success: false, error: t('请选择数据库') }
    return
  }
  if (operateType.value !== 'QUERY' && !scriptType.value) {
    result.value = { success: false, error: t('请选择脚本类型') }
    return
  }

  let finalDirName = dirName.value.trim()
  if (!finalDirName) {
    const now = new Date()
    const monthDay = now.toISOString().slice(5, 10).replace(/-/g, '')
    finalDirName = usage.value.trim()
      ? `${monthDay}-${usage.value.trim()}`
      : t('{p0}-{p1}', { p0: monthDay, p1: t('脚本') })
    dirName.value = finalDirName
  }

  loading.value = true
  result.value = null

  try {
    const res = await generateScript({
      operateType: operateType.value,
      usage: usage.value.trim(),
      database: database.value,
      scriptType: scriptType.value,
      dirName: finalDirName
    })
    result.value = res
    if (res?.success) {
      lastDirName.value = finalDirName
      localStorage.setItem(LAST_DIR_NAME_KEY, finalDirName)
      scriptManagerRef.value?.refresh()
    }
  } catch (e) {
    result.value = { success: false, error: e.message }
  } finally {
    loading.value = false
  }
}

async function openFile() {
  if (result.value?.filePath) {
    await apiOpenFile(result.value.filePath)
  }
}

async function openFolder() {
  if (result.value?.targetPath) {
    await apiOpenFolder(result.value.targetPath)
  }
}

function handleUsageInput() {
  if (!useLastDirName.value) updateDirName()
}

function handleDirNameInput() {
  useLastDirName.value = false
}

function toggleUseLastDirName(event) {
  useLastDirName.value = event.target.checked
  if (useLastDirName.value) {
    dirName.value = lastDirName.value
  } else {
    updateDirName(true)
  }
}

onMounted(() => {
  updateDirName(true)
})

watch(config, () => {
  if (!useLastDirName.value) updateDirName(true)
})
</script>

<style scoped>
.page-body {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.page-body > .generator-grid + .script-manager-panel {
  margin-top: 14px;
}

.generator-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(280px, 1fr);
  gap: 14px;
  align-items: stretch;
}

.form-panel,
.preview-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.generator-grid > .preview-panel {
  margin-top: 0;
}

.form-panel .panel-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 16px;
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.mode-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 11px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.mode-option::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: transparent;
  transition: background var(--motion-fast) var(--motion-ease);
}

.mode-option:hover {
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.mode-option.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: rgba(var(--accent-rgb), 0.07);
  color: var(--text-primary);
}

.mode-option.active::before {
  background: var(--accent-color);
}

.mode-option.active::after {
  content: '';
  position: absolute;
  top: 12px;
  right: 12px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.14);
}

.mode-option:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.mode-option-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: 0.4px;
}

.mode-option.active .mode-option-label {
  color: var(--accent-color);
}

.mode-option-desc {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.form-grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 14px 16px;
  padding-bottom: 18px;
}

.field {
  min-width: 0;
}

.field-wide {
  grid-column: 1 / -1;
}

.field > label {
  display: block;
  margin-bottom: 6px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
}

.field-hint {
  display: block;
  margin-top: 5px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.dir-name-row {
  display: flex;
}

.dir-name-row .input-field {
  flex: 1;
  min-width: 0;
}

.dir-name-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.dir-name-last {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(320px, 100%);
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 24px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dir-name-option {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  user-select: none;
  transition: var(--transition-fast);
}

.dir-name-option:hover {
  border-color: var(--border-strong);
}

.dir-name-option.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: rgba(var(--accent-rgb), 0.07);
  color: var(--text-primary);
}

.dir-name-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.dir-name-option-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 26px;
  height: 15px;
  border-radius: 999px;
  background: var(--border-strong);
  transition: background var(--motion-fast) var(--motion-ease);
}

.dir-name-option-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: transform var(--motion-fast) var(--motion-ease);
}

.dir-name-option.active .dir-name-option-track {
  background: var(--accent-color);
}

.dir-name-option.active .dir-name-option-thumb {
  transform: translateX(11px);
}

.dir-name-option input:focus-visible + .dir-name-option-track {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: auto -16px -16px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.form-footer-hint {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-tertiary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sql-generate-btn {
  flex-shrink: 0;
  gap: 6px;
  min-width: 108px;
  justify-content: center;
}

.generate-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: generate-spin 0.7s linear infinite;
}

@keyframes generate-spin {
  to {
    transform: rotate(360deg);
  }
}

.preview-panel .panel-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 16px;
}

.preview-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.preview-path {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.preview-segment {
  max-width: 100%;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.preview-segment.auto {
  border-style: dashed;
  color: var(--text-tertiary);
}

.preview-sep {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 14px;
}

.preview-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.preview-dot {
  width: 5px;
  height: 5px;
  margin-top: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--accent-color);
}

.preview-item code {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
}

.preview-root {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px dashed var(--border-color);
}

.preview-root-label {
  margin-bottom: 5px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.preview-root-value {
  color: var(--text-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  word-break: break-all;
}

.result-panel {
  flex-shrink: 0;
  margin-top: 14px;
}

.result-panel.is-success {
  border-color: rgba(var(--success-rgb), 0.35);
}

.result-panel.is-error {
  border-color: rgba(var(--error-rgb), 0.35);
}

.result-panel.is-success .panel-header {
  background: rgba(var(--success-rgb), 0.08);
}

.result-panel.is-error .panel-header {
  background: rgba(var(--error-rgb), 0.08);
}

.result-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.result-badge.success {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
}

.result-badge.error {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.result-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
}

.result-icon svg {
  width: 18px;
  height: 18px;
}

.is-success .result-icon {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
}

.is-error .result-icon {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.result-message {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.result-message.success {
  color: var(--success-dark);
}

.result-message.error {
  color: var(--error-dark);
}

.result-sub {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.result-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  font-size: var(--font-size-sm);
}

.result-label {
  color: var(--text-tertiary);
}

.result-value {
  color: var(--text-primary);
  word-break: break-all;
}

.result-row code {
  color: var(--text-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  word-break: break-all;
}

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

@media (max-width: 1100px) {
  .generator-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .dir-name-last {
    flex: 1 1 120px;
    max-width: none;
  }

  .mode-options {
    grid-template-columns: 1fr;
  }

  .form-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
