<template>
  <div class="image-host-settings">
    <div v-if="loading" class="ihs-empty">{{ t('正在读取图床配置…') }}</div>
    <template v-else>
      <section class="setting-section">
        <div class="setting-section-head">
          <h3 class="setting-section-title">{{ t('上传设置') }}</h3>
          <span class="setting-section-desc">{{ t('上传图片时使用的图床服务与全局限制；选择后自动保存') }}</span>
        </div>
        <div class="setting-section-body">
          <div class="setting-row">
            <div class="setting-row-text">
              <span class="setting-row-label">{{ t('当前图床') }}</span>
              <span class="setting-row-desc">{{ t('上传图片时使用该服务；需先在下方卡片中完成必填项') }}</span>
            </div>
            <div class="setting-row-control">
              <SettingSelect
                :model-value="settings.active"
                :options="providerOptions"
                :disabled="savingPrefs"
                @update:model-value="changeActive"
              />
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-row-text">
              <span class="setting-row-label">{{ t('单文件上限') }}</span>
              <span class="setting-row-desc">{{ t('单张图片超过该大小时拒绝上传') }}</span>
            </div>
            <div class="setting-row-control">
              <SettingSelect
                :model-value="String(settings.maxFileMb)"
                :options="maxFileMbOptions"
                :disabled="savingPrefs"
                @update:model-value="changeMaxFileMb"
              />
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-row-text">
              <span class="setting-row-label">{{ t('历史保留条数') }}</span>
              <span class="setting-row-desc">{{ t('超出后自动清理最早的上传记录') }}</span>
            </div>
            <div class="setting-row-control">
              <SettingSelect
                :model-value="String(settings.historyLimit)"
                :options="historyLimitOptions"
                :disabled="savingPrefs"
                @update:model-value="changeHistoryLimit"
              />
            </div>
          </div>
        </div>
      </section>

      <div class="provider-cards">
        <div
          v-for="provider in providers"
          :key="provider.id"
          class="provider-card"
          :class="{ expanded: isExpanded(provider.id) }"
        >
          <div
            class="provider-card-header"
            role="button"
            tabindex="0"
            @click="toggleExpanded(provider.id)"
            @keydown.enter.prevent="toggleExpanded(provider.id)"
          >
            <div class="provider-title">
              <span class="provider-name">{{ t(provider.name) }}</span>
              <span class="provider-id">{{ provider.id }}</span>
              <span class="provider-tag" :class="{ configured: isConfigured(provider.id) }">
                {{ isConfigured(provider.id) ? t('已配置') : t('未配置') }}
              </span>
              <span v-if="provider.id === settings.active" class="provider-tag default-chat">{{ t('当前图床') }}</span>
              <span v-if="isProviderDirty(provider.id)" class="provider-tag custom">{{ t('未保存') }}</span>
            </div>
            <div class="provider-header-actions">
              <button v-if="provider.docsUrl" type="button" class="link-btn" @click.stop="openDocs(provider)">
                {{ provider.docsLabel ? t(provider.docsLabel) : t('查看文档') }}
              </button>
              <button
                type="button"
                class="provider-edit-btn"
                :aria-expanded="isExpanded(provider.id)"
                @click.stop="toggleExpanded(provider.id)"
              >
                {{ isExpanded(provider.id) ? t('收起') : t('编辑') }}
                <AppIcon
                  name="chevron-down"
                  :size="13"
                  class="provider-chevron"
                  :class="{ rotated: isExpanded(provider.id) }"
                />
              </button>
            </div>
          </div>

          <div
            class="provider-collapse"
            :class="{ open: isExpanded(provider.id) }"
            :inert="isExpanded(provider.id) ? null : ''"
            :aria-hidden="isExpanded(provider.id) ? 'false' : 'true'"
          >
            <div class="provider-collapse-inner">
              <div class="provider-card-body">
                <p class="provider-desc">{{ t(provider.description) }}</p>

                <div class="provider-field">
                  <div v-for="field in provider.fields" :key="field.key" class="setting-row">
                    <div class="setting-row-text">
                      <span class="setting-row-label">
                        {{ t(field.label) }}
                        <span v-if="field.required" class="ihs-required">*</span>
                      </span>
                      <span v-if="field.hint" class="setting-row-desc">{{ t(field.hint) }}</span>
                    </div>
                    <div class="setting-row-control">
                      <SettingSelect
                        v-if="field.type === 'select'"
                        v-model="settings.providers[provider.id][field.key]"
                        :options="field.options || []"
                      />

                      <label v-else-if="field.type === 'switch'" class="ihs-switch">
                        <input v-model="settings.providers[provider.id][field.key]" type="checkbox" class="switch" />
                        <span>{{ settings.providers[provider.id][field.key] ? t('已开启') : t('已关闭') }}</span>
                      </label>

                      <div v-else-if="field.type === 'password'" class="api-key-input-group">
                        <AppInput
                          v-model="settings.providers[provider.id][field.key]"
                          :type="secretsVisible[provider.id] ? 'text' : 'password'"
                          :placeholder="t(field.placeholder || '')"
                          spellcheck="false"
                        />
                        <button type="button" class="btn btn-secondary" @click="toggleSecrets(provider.id)">
                          {{ secretsVisible[provider.id] ? t('隐藏') : t('显示') }}
                        </button>
                      </div>

                      <AppTextarea
                        v-else-if="field.type === 'textarea'"
                        v-model="settings.providers[provider.id][field.key]"
                        class="ihs-textarea"
                        :placeholder="t(field.placeholder || '')"
                        rows="3"
                        spellcheck="false"
                      />

                      <AppInput
                        v-else
                        v-model="settings.providers[provider.id][field.key]"
                        :placeholder="t(field.placeholder || '')"
                        spellcheck="false"
                      />
                    </div>
                  </div>
                </div>

                <p v-if="missingLabels(provider.id)" class="ihs-missing">
                  {{ t('还需要填写：{fields}', { fields: missingLabels(provider.id) }) }}
                </p>
                <p
                  v-if="testResults[provider.id]"
                  class="api-test-result"
                  :class="testResults[provider.id].success ? 'success' : 'error'"
                >
                  {{ testResults[provider.id].message }}
                </p>

                <div class="provider-card-footer">
                  <button
                    type="button"
                    class="btn btn-secondary ihs-test-btn"
                    :disabled="testing[provider.id]"
                    @click="testConnection(provider)"
                  >
                    {{ testing[provider.id] ? t('测试中…') : t('测试连通性') }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    :disabled="!isProviderDirty(provider.id)"
                    @click="revertProvider(provider)"
                  >
                    {{ t('还原') }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    :disabled="Boolean(savingProvider) || !isProviderDirty(provider.id)"
                    @click="saveProvider(provider)"
                  >
                    {{ savingProvider === provider.id ? t('保存中…') : t('保存') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { imageHostSaveSettings, imageHostState, imageHostTest, openExternal } from '@/api'
import { useToast } from '@/composables'
import {
  IMAGE_HOST_HISTORY_LIMIT_OPTIONS,
  IMAGE_HOST_MAX_FILE_MB_OPTIONS,
  IMAGE_HOST_PROVIDERS,
  createDefaultImageHostSettings,
  getMissingRequiredFields,
  isProviderConfigured,
  normalizeImageHostSettings
} from '@shared/imageHosts'
import { t } from '@/i18n'
import SettingSelect from '@/components/settings/SettingSelect.vue'

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'
const providers = IMAGE_HOST_PROVIDERS
const historyLimitOptions = IMAGE_HOST_HISTORY_LIMIT_OPTIONS.map((option) => ({
  ...option,
  value: String(option.value)
}))
const maxFileMbOptions = IMAGE_HOST_MAX_FILE_MB_OPTIONS.map((option) => ({ ...option, value: String(option.value) }))
const { showSuccess, showError } = useToast()

const settings = ref(createDefaultImageHostSettings())
const savedSettings = ref(createDefaultImageHostSettings())
const loading = ref(true)
const savingPrefs = ref(false)
const savingProvider = ref('')
const expanded = ref({})
const secretsVisible = ref({})
const testing = ref({})
const testResults = ref({})
let saveQueue = Promise.resolve()

const providerOptions = computed(() =>
  providers.map((provider) => ({
    value: provider.id,
    label: t(provider.name),
    hint: isConfigured(provider.id)
      ? provider.description
      : t('{description}（未配置）', { description: provider.description })
  }))
)

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isConfigured(providerId) {
  return isProviderConfigured(providerId, settings.value.providers[providerId])
}

function missingLabels(providerId) {
  return getMissingRequiredFields(providerId, settings.value.providers[providerId])
    .map((field) => t(field.label))
    .join(t('、'))
}

function isProviderDirty(providerId) {
  return (
    JSON.stringify(settings.value.providers[providerId]) !== JSON.stringify(savedSettings.value.providers[providerId])
  )
}

function isExpanded(providerId) {
  return Boolean(expanded.value[providerId])
}

function toggleExpanded(providerId) {
  expanded.value = { ...expanded.value, [providerId]: !expanded.value[providerId] }
}

function toggleSecrets(providerId) {
  secretsVisible.value = { ...secretsVisible.value, [providerId]: !secretsVisible.value[providerId] }
}

function openDocs(provider) {
  if (provider.docsUrl) openExternal(provider.docsUrl)
}

function syncPrefsFromSaved() {
  settings.value.active = savedSettings.value.active
  settings.value.maxFileMb = savedSettings.value.maxFileMb
  settings.value.historyLimit = savedSettings.value.historyLimit
}

function syncProviderFromSaved(providerId) {
  settings.value.providers[providerId] = clone(savedSettings.value.providers[providerId])
}

function runSave(mutator) {
  const task = saveQueue.then(
    () => persistWith(mutator),
    () => persistWith(mutator)
  )
  saveQueue = task.catch(() => {})
  return task
}

async function persistWith(mutator) {
  const payload = mutator(clone(savedSettings.value))
  const response = await imageHostSaveSettings(payload)
  if (!response?.success) throw new Error(t('保存图床配置失败'))
  savedSettings.value = normalizeImageHostSettings(response.settings)
}

async function savePrefs() {
  if (savingPrefs.value) return
  savingPrefs.value = true
  try {
    await runSave((snapshot) => ({
      ...snapshot,
      active: settings.value.active,
      maxFileMb: Number(settings.value.maxFileMb),
      historyLimit: Number(settings.value.historyLimit)
    }))
    syncPrefsFromSaved()
  } catch (error) {
    syncPrefsFromSaved()
    showError(error?.message || t('保存图床配置失败'))
  } finally {
    savingPrefs.value = false
  }
}

function changeActive(providerId) {
  if (providerId === settings.value.active) return
  settings.value.active = providerId
  void savePrefs()
}

function changeMaxFileMb(value) {
  settings.value.maxFileMb = Number(value)
  void savePrefs()
}

function changeHistoryLimit(value) {
  settings.value.historyLimit = Number(value)
  void savePrefs()
}

function revertProvider(provider) {
  syncProviderFromSaved(provider.id)
  testResults.value = { ...testResults.value, [provider.id]: null }
}

async function saveProvider(provider) {
  if (savingProvider.value) return
  const providerId = provider.id
  savingProvider.value = providerId
  try {
    await runSave((snapshot) => ({
      ...snapshot,
      active: settings.value.active,
      maxFileMb: Number(settings.value.maxFileMb),
      historyLimit: Number(settings.value.historyLimit),
      providers: {
        ...snapshot.providers,
        [providerId]: clone(settings.value.providers[providerId])
      }
    }))
    syncProviderFromSaved(providerId)
    syncPrefsFromSaved()
    showSuccess(t('图床配置已保存'))
  } catch (error) {
    showError(error?.message || t('保存图床配置失败'))
  } finally {
    savingProvider.value = ''
  }
}

async function testConnection(provider) {
  const providerId = provider.id
  if (testing.value[providerId]) return
  testing.value = { ...testing.value, [providerId]: true }
  testResults.value = {
    ...testResults.value,
    [providerId]: { success: false, message: t('正在测试连接…') }
  }
  try {
    const response = await imageHostTest(providerId, clone(settings.value.providers[providerId]))
    testResults.value = {
      ...testResults.value,
      [providerId]: {
        success: response?.success === true,
        message: response?.success ? response.message || t('连接正常') : response?.message || t('连接测试失败')
      }
    }
  } catch (error) {
    testResults.value = {
      ...testResults.value,
      [providerId]: { success: false, message: error?.message || t('连接测试失败') }
    }
  } finally {
    testing.value = { ...testing.value, [providerId]: false }
  }
}

async function load() {
  loading.value = true
  try {
    const state = await imageHostState()
    const normalized = normalizeImageHostSettings(state?.settings)
    savedSettings.value = clone(normalized)
    settings.value = clone(normalized)
    expanded.value = { [normalized.active]: true }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.image-host-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ihs-empty {
  padding: 18px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

/* 以下为设置页设计系统在组件内的等价样式（Settings.vue 的样式为 scoped，无法穿透） */
.setting-section {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.setting-section-head {
  padding: 12px 16px 10px;
  border-bottom: 1px dashed var(--border-color);
}

.setting-section-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}

.setting-section-desc {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--text-tertiary);
}

.setting-section-body {
  display: flex;
  flex-direction: column;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(200px, 320px) 1fr;
  align-items: center;
  gap: 8px 24px;
  padding: 12px 16px;
}

.setting-row + .setting-row {
  border-top: 1px dashed var(--border-color);
}

.setting-row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-row-label {
  font-size: var(--font-size-dense);
  font-weight: 500;
  line-height: 1.4;
  color: var(--text-primary);
}

.setting-row-desc {
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--text-tertiary);
}

.setting-row-control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.setting-row-control > .input-field,
.setting-row-control > .api-key-input-group {
  flex: 1 1 auto;
  width: 100%;
}

.setting-row-control > .setting-select {
  flex: 0 1 320px;
  width: auto;
}

.setting-row-control > .btn {
  flex-shrink: 0;
}

.provider-field > .setting-row {
  padding: 0;
}

@media (max-width: 720px) {
  .setting-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .setting-row-control {
    justify-content: flex-start;
  }

  .setting-row-control > .setting-select {
    flex: 1 1 auto;
    width: 100%;
  }
}

.provider-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provider-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
  transition: var(--transition-fast);
}

.provider-card:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
}

.provider-card.expanded {
  border-color: rgba(var(--accent-rgb), 0.35);
  box-shadow: var(--shadow-md);
}

.provider-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  cursor: pointer;
  user-select: none;
}

.provider-card-header:hover {
  background: var(--surface-hover);
}

.provider-card.expanded .provider-card-header {
  border-bottom: 1px solid var(--border-color);
}

.provider-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.provider-name {
  font-size: var(--font-size-dense);
  font-weight: 600;
  color: var(--text-primary);
}

.provider-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.provider-header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
}

.provider-chevron {
  color: var(--text-tertiary);
  transition: transform 0.18s ease;
}

.provider-chevron.rotated {
  transform: rotate(180deg);
}

.provider-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.provider-tag.configured {
  color: var(--success-dark);
  border-color: rgba(var(--success-rgb), 0.35);
  background: rgba(var(--success-rgb), 0.1);
}

.provider-tag.custom {
  color: var(--warning-darker);
  border-color: rgba(var(--warning-rgb), 0.35);
  background: rgba(var(--warning-rgb), 0.1);
}

.provider-tag.default-chat {
  color: var(--accent-color);
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.08);
}

.link-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-color);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.provider-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.provider-edit-btn:hover {
  color: var(--accent-color);
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.06);
}

.provider-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.24s ease;
}

.provider-collapse.open {
  grid-template-rows: 1fr;
}

.provider-collapse > .provider-collapse-inner {
  min-height: 0;
  overflow: hidden;
}

.provider-card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.provider-desc {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--text-tertiary);
}

.provider-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-field > .setting-row + .setting-row {
  padding-top: 12px;
}

.api-key-input-group {
  display: flex;
  gap: 8px;
}

.api-key-input-group .input-field {
  flex: 1;
}

.api-test-result {
  margin: 0;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.api-test-result.success {
  background: rgba(var(--success-rgb), 0.1);
  color: var(--success-dark);
  border: 1px solid rgba(var(--success-rgb), 0.3);
}

.api-test-result.error {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
  border: 1px solid rgba(var(--error-rgb), 0.3);
}

.provider-card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ihs-test-btn {
  margin-right: auto;
}

.ihs-required {
  color: var(--error-color);
  margin-left: 2px;
}

.ihs-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.ihs-textarea {
  resize: vertical;
  font-family: var(--font-mono);
  font-size: var(--font-size-dense);
}

.ihs-missing {
  margin: 0;
  color: var(--warning-darker);
  font-size: var(--font-size-sm);
}

@media (max-width: 900px) {
  .provider-field > .setting-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .provider-field > .setting-row .setting-row-control {
    justify-content: flex-start;
  }
}
</style>
