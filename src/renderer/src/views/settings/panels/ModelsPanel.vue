<template>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('对话设置') }}</h3>
      <span class="setting-section-desc">{{
        t('聊天页新会话默认使用的模型，以及单次请求的等待时间；选择后自动保存')
      }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('默认对话模型') }}</span>
          <span class="setting-row-desc">{{ t('仅在已配置密钥的服务商中选择；不可用时回退到其他已配置服务商') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="aiProviderModel" :options="chatModelOptions" :placeholder="t('跟随已配置的服务商')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('请求超时') }}</span>
          <span class="setting-row-desc">{{ t('单次对话或工具调用等待响应的最长时间，超时会中断并提示错误') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="aiTimeout" :options="aiTimeoutOptions" :placeholder="t('选择超时时间')" />
        </div>
      </div>
    </div>
  </section>

  <div class="provider-cards">
    <div v-if="visibleProviders.length === 0" class="provider-empty">
      {{ t('尚未添加模型服务商，可通过下方按钮添加') }}
    </div>
    <div
      v-for="provider in visibleProviders"
      :key="provider.type"
      class="provider-card"
      :class="{ expanded: isProviderExpanded(provider.type) }"
    >
      <div
        class="provider-card-header"
        role="button"
        tabindex="0"
        @click="toggleProviderExpanded(provider.type)"
        @keydown.enter.prevent="toggleProviderExpanded(provider.type)"
      >
        <div class="provider-title">
          <span class="provider-name">{{ t(provider.name) }}</span>
          <span class="provider-id">{{ provider.type }}</span>
          <span class="provider-tag" :class="{ configured: hasProviderKey(provider.type) }">
            {{ hasProviderKey(provider.type) ? t('已配置') : t('未配置') }}
          </span>
          <span v-if="provider.type === aiProvider" class="provider-tag default-chat">{{ t('默认对话') }}</span>
          <span v-if="aiBaseUrls[provider.type]" class="provider-tag custom">{{ t('自定义地址') }}</span>
        </div>
        <div class="provider-header-actions">
          <button v-if="provider.docsUrl" type="button" class="link-btn" @click.stop="openProviderDocs(provider)">
            {{ t('服务商文档') }}
          </button>
          <button
            type="button"
            class="provider-edit-btn"
            :aria-expanded="isProviderExpanded(provider.type)"
            @click.stop="toggleProviderExpanded(provider.type)"
          >
            {{ isProviderExpanded(provider.type) ? t('收起') : t('编辑') }}
            <AppIcon
              name="chevron-down"
              :size="13"
              class="provider-chevron"
              :class="{ rotated: isProviderExpanded(provider.type) }"
            />
          </button>
        </div>
      </div>

      <div
        class="provider-collapse"
        :class="{ open: isProviderExpanded(provider.type) }"
        :inert="isProviderExpanded(provider.type) ? null : ''"
        :aria-hidden="isProviderExpanded(provider.type) ? 'false' : 'true'"
      >
        <div class="provider-collapse-inner">
          <div class="provider-card-body">
            <div class="provider-field">
              <div v-if="provider.requiresApiKey !== false" class="setting-row">
                <div class="setting-row-text">
                  <span class="setting-row-label">{{ t('API 密钥') }}</span>
                  <span class="setting-row-desc">
                    {{
                      provider.envKey
                        ? t('留空时会读取 {envKey} 环境变量', { envKey: provider.envKey })
                        : t('填写服务商控制台生成的 API 密钥')
                    }}
                  </span>
                </div>
                <div class="setting-row-control">
                  <div class="api-key-input-group">
                    <AppInput
                      v-model="aiApiKeys[provider.type]"
                      :type="showApiKey[provider.type] ? 'text' : 'password'"
                      :placeholder="
                        provider.hasEnvKey
                          ? t('已通过 {envKey} 提供', { envKey: provider.envKey })
                          : t('输入 {provider} API Key', { provider: t(provider.name) })
                      "
                    />
                    <button class="btn btn-secondary" @click="toggleShowApiKey(provider.type)">
                      {{ showApiKey[provider.type] ? t('隐藏') : t('显示') }}
                    </button>
                    <button
                      class="btn btn-primary"
                      :disabled="
                        (!hasStoredApiKey(provider.type) && !provider.hasEnvKey) || testingApiKey[provider.type]
                      "
                      @click="testApiKey(provider)"
                    >
                      {{ testingApiKey[provider.type] ? t('验证中...') : t('验证') }}
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="setting-row">
                <div class="setting-row-text">
                  <span class="setting-row-label">{{ t('API 密钥') }}</span>
                  <span class="setting-row-desc">{{ t('本地服务无需 API Key，启动服务后获取模型即可') }}</span>
                </div>
                <div class="setting-row-control">
                  <button
                    class="btn btn-primary"
                    :disabled="testingApiKey[provider.type]"
                    @click="testApiKey(provider)"
                  >
                    {{ testingApiKey[provider.type] ? t('验证中...') : t('测试连接') }}
                  </button>
                </div>
              </div>
              <div
                v-if="apiKeyTestResult[provider.type]"
                class="api-test-result"
                :class="apiKeyTestResult[provider.type].success ? 'success' : 'error'"
              >
                {{ apiKeyTestResult[provider.type].message }}
              </div>
              <div
                v-if="provider.envKey && !hasStoredApiKey(provider.type)"
                class="env-status"
                :class="provider.hasEnvKey ? 'detected' : 'missing'"
              >
                {{
                  provider.hasEnvKey
                    ? t('已检测到环境变量 {envKey}，无需填写密钥', { envKey: provider.envKey })
                    : t('未检测到环境变量 {envKey}，请填写密钥或先设置环境变量', { envKey: provider.envKey })
                }}
              </div>
            </div>

            <div class="custom-settings">
              <button type="button" class="custom-settings-toggle" @click="toggleCustomSettings(provider.type)">
                <AppIcon
                  name="chevron-right"
                  size="12"
                  class="provider-chevron small"
                  :class="{ rotated: isCustomSettingsOpen(provider.type) }"
                />
                <span>{{ t('自定义设置') }}</span>
              </button>
              <div v-if="isCustomSettingsOpen(provider.type)" class="custom-settings-body">
                <div class="setting-row">
                  <div class="setting-row-text">
                    <span class="setting-row-label">{{ t('API 地址') }}</span>
                    <span class="setting-row-desc">{{ t('使用 OpenAI 兼容协议，留空则使用服务商默认地址') }}</span>
                  </div>
                  <div class="setting-row-control">
                    <AppInput v-model="aiBaseUrls[provider.type]" :placeholder="provider.defaultBaseUrl" />
                  </div>
                </div>
              </div>
            </div>

            <div class="model-section">
              <div class="model-section-header">
                <div class="field-label-col">
                  <label>{{ t('模型目录') }}</label>
                  <span class="setting-row-desc">{{ t('模型列表用于聊天时选择；可手动增删并配置高级参数') }}</span>
                </div>
                <div class="model-config-actions">
                  <button
                    class="btn btn-secondary"
                    :disabled="modelFetching[provider.type]"
                    @click="refreshModels(provider)"
                  >
                    {{ modelFetching[provider.type] ? t('获取中...') : t('获取最新模型') }}
                  </button>
                  <button
                    class="btn btn-secondary"
                    :disabled="modelFetching[provider.type]"
                    @click="resetModels(provider)"
                  >
                    {{ t('恢复内置模型') }}
                  </button>
                </div>
              </div>
              <div class="setting-hint">{{ t(modelSourceHint(provider.type)) }}</div>

              <div
                v-if="modelFetchMessage[provider.type]"
                class="api-test-result"
                :class="modelFetchSuccess[provider.type] ? 'success' : 'error'"
              >
                {{ modelFetchMessage[provider.type] }}
              </div>

              <div class="model-default-row">
                <label>{{ t('默认模型') }}</label>
                <SettingSelect
                  v-model="modelConfigs[provider.type].default"
                  :options="modelDefaultOptions(provider.type)"
                  :placeholder="t('跟随列表第一个模型')"
                />
              </div>

              <div class="model-list">
                <div
                  v-for="(model, index) in modelConfigs[provider.type].models"
                  :key="provider.type + '-model-' + index"
                  class="model-item"
                  :class="{
                    dragging: isModelDragging(provider.type, index),
                    'drag-over': isModelDragOver(provider.type, index)
                  }"
                  :draggable="isModelDragEnabled(provider.type)"
                  @dragstart="startModelDrag(provider.type, index, $event)"
                  @dragover.prevent="overModelDrag(provider.type, index)"
                  @drop.stop.prevent="dropModelDrag(provider.type)"
                  @dragend="endModelDrag(provider.type)"
                >
                  <div class="model-row">
                    <span
                      class="model-drag-handle"
                      :title="t('拖动排序')"
                      @mousedown="enableModelDrag(provider.type)"
                      @click="endModelDrag(provider.type)"
                    >
                      <AppIcon name="grip" />
                    </span>
                    <AppInput v-model="model.id" class="model-id" :placeholder="t('模型 ID')" />
                    <AppInput v-model="model.name" class="model-name" :placeholder="t('显示名称')" />
                    <button
                      type="button"
                      class="model-icon-btn"
                      :title="isModelExpanded(provider.type, index) ? t('收起高级参数') : t('展开高级参数')"
                      @click="toggleModelExpanded(provider.type, index)"
                    >
                      <AppIcon
                        name="chevron-down"
                        :size="12"
                        class="provider-chevron small"
                        :class="{ rotated: isModelExpanded(provider.type, index) }"
                      />
                    </button>
                    <button
                      type="button"
                      class="model-icon-btn danger"
                      :title="t('删除模型')"
                      @click="removeModel(provider.type, index)"
                    >
                      <AppIcon name="trash" size="14" />
                    </button>
                  </div>
                  <div v-if="isModelExpanded(provider.type, index)" class="model-advanced">
                    <div class="setting-row">
                      <div class="setting-row-text">
                        <span class="setting-row-label">{{ t('上下文窗口') }}</span>
                        <span class="setting-row-desc">{{
                          t('单次请求可处理的最大 token 数，留空使用服务商默认')
                        }}</span>
                      </div>
                      <div class="setting-row-control">
                        <AppInput
                          v-model.number="model.contextWindow"
                          type="number"
                          min="1"
                          :placeholder="t('默认 {value}', { value: defaultContextWindow(provider) })"
                        />
                      </div>
                    </div>
                    <div class="setting-row">
                      <div class="setting-row-text">
                        <span class="setting-row-label">{{ t('最大输出 token 数') }}</span>
                        <span class="setting-row-desc">{{ t('单次回复生成的最大 token 数，留空使用服务商默认') }}</span>
                      </div>
                      <div class="setting-row-control">
                        <AppInput
                          v-model.number="model.maxOutput"
                          type="number"
                          min="1"
                          :placeholder="t('留空使用服务商默认')"
                        />
                      </div>
                    </div>
                    <div class="setting-row">
                      <div class="setting-row-text">
                        <span class="setting-row-label">{{ t('输入类型') }}</span>
                        <span class="setting-row-desc">{{ t('该模型支持的消息输入类型') }}</span>
                      </div>
                      <div class="setting-row-control">
                        <div class="input-type-options">
                          <label class="checkbox-field">
                            <input
                              type="checkbox"
                              class="switch"
                              :checked="hasInputType(model, 'text')"
                              @change="toggleInputType(model, 'text')"
                            />
                            {{ t('文本') }}
                          </label>
                          <label class="checkbox-field">
                            <input
                              type="checkbox"
                              class="switch"
                              :checked="hasInputType(model, 'image')"
                              @change="toggleInputType(model, 'image')"
                            />
                            {{ t('图片') }}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="modelConfigs[provider.type].models.length === 0" class="model-empty">
                  {{ t('暂无模型，请获取最新模型或手动添加') }}
                </div>
              </div>

              <button type="button" class="add-model-btn" @click="addModel(provider.type)">
                {{ t('+ 添加模型') }}
              </button>
            </div>

            <div class="provider-card-footer">
              <button
                type="button"
                class="btn btn-danger provider-remove-btn"
                :disabled="providerSaving[provider.type]"
                @click="requestRemoveProvider(provider)"
              >
                {{ t('移除服务商') }}
              </button>
              <button class="btn btn-secondary" @click="cancelProviderCard(provider)">
                {{ pendingProviders[provider.type] ? t('取消添加') : t('还原') }}
              </button>
              <button
                class="btn btn-primary"
                :disabled="providerSaving[provider.type]"
                @click="saveProviderCard(provider)"
              >
                {{ providerSaving[provider.type] ? t('保存中...') : t('保存') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="provider-add-toggle"
      :class="{ open: addProviderOpen }"
      :disabled="addableProviders.length === 0 && !addProviderOpen"
      :aria-expanded="addProviderOpen"
      @click="addProviderOpen = !addProviderOpen"
    >
      <span>{{
        addableProviders.length === 0 && !addProviderOpen ? t('全部模型服务商已添加') : t('+ 添加模型服务商')
      }}</span>
      <AppIcon
        v-if="addableProviders.length > 0 || addProviderOpen"
        name="chevron-down"
        class="provider-chevron"
        :class="{ rotated: addProviderOpen }"
        :size="13"
      />
    </button>

    <div v-if="addProviderOpen" class="provider-add-panel">
      <button
        v-for="provider in addableProviders"
        :key="provider.type"
        type="button"
        class="provider-add-option"
        @click="addProvider(provider)"
      >
        <span class="provider-add-option-name">{{ t(provider.name) }}</span>
        <span class="provider-add-option-desc">{{ t(provider.description) }}</span>
        <span class="provider-add-option-action">{{ t('添加') }}</span>
      </button>
    </div>
  </div>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('故障转移') }}</h3>
      <span class="setting-section-desc">{{
        t('主模型重试后仍失败时，按顺序切换备用模型；留空则自动选择其他已配置密钥的服务商')
      }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('自动切换') }}</span>
          <span class="setting-row-desc">{{ t('主模型调用失败并重试后，自动尝试备用模型') }}</span>
        </div>
        <div class="setting-row-control">
          <input v-model="fallbackEnabled" type="checkbox" class="switch" />
        </div>
      </div>
      <div class="setting-row is-block">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('备用模型') }}</span>
          <span class="setting-row-desc">{{ t('按从上到下的顺序尝试，最多 5 个；格式为 provider:model') }}</span>
        </div>
        <div class="setting-row-control fallback-model-list">
          <div v-for="(_, index) in fallbackModels" :key="index" class="fallback-model-row">
            <SettingModelPicker
              v-model="fallbackModels[index]"
              :options="fallbackModelOptions"
              :placeholder="t('如 deepseek:deepseek-chat')"
            />
            <button
              type="button"
              class="model-icon-btn danger"
              :title="t('移除备用模型')"
              @click="removeFallbackModel(index)"
            >
              <AppIcon name="trash" size="14" />
            </button>
          </div>
          <div v-if="fallbackModels.length === 0" class="fallback-model-empty">
            {{ t('未配置备用模型，主模型失败时将尝试其他已配置服务商') }}
          </div>
          <button type="button" class="add-model-btn" :disabled="fallbackModels.length >= 5" @click="addFallbackModel">
            {{ t('+ 添加备用模型') }}
          </button>
        </div>
      </div>
    </div>
  </section>

  <MessageDialog
    :visible="Boolean(removeProviderTarget)"
    type="confirm"
    :title="t('移除模型服务商')"
    :message="removeProviderMessage"
    @confirm="confirmRemoveProvider"
    @cancel="removeProviderTarget = ''"
    @close="removeProviderTarget = ''"
  />
</template>

<script setup>
import { inject } from 'vue'
import { t } from '@/i18n'
import SettingSelect from '@/components/settings/SettingSelect.vue'
import SettingModelPicker from '@/components/settings/SettingModelPicker.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { SETTINGS_CONTEXT } from '../settingsContext'

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
const {
  addFallbackModel,
  addModel,
  addProvider,
  addProviderOpen,
  addableProviders,
  aiApiKeys,
  aiBaseUrls,
  aiProvider,
  aiProviderModel,
  aiTimeout,
  aiTimeoutOptions,
  apiKeyTestResult,
  cancelProviderCard,
  chatModelOptions,
  confirmRemoveProvider,
  defaultContextWindow,
  dropModelDrag,
  enableModelDrag,
  endModelDrag,
  fallbackEnabled,
  fallbackModelOptions,
  fallbackModels,
  hasInputType,
  hasProviderKey,
  hasStoredApiKey,
  isCustomSettingsOpen,
  isModelDragEnabled,
  isModelDragOver,
  isModelDragging,
  isModelExpanded,
  isProviderExpanded,
  modelConfigs,
  modelDefaultOptions,
  modelFetchMessage,
  modelFetchSuccess,
  modelFetching,
  modelSourceHint,
  openProviderDocs,
  overModelDrag,
  pendingProviders,
  providerSaving,
  refreshModels,
  removeFallbackModel,
  removeModel,
  removeProviderMessage,
  removeProviderTarget,
  requestRemoveProvider,
  resetModels,
  saveProviderCard,
  showApiKey,
  startModelDrag,
  testApiKey,
  testingApiKey,
  toggleCustomSettings,
  toggleInputType,
  toggleModelExpanded,
  toggleProviderExpanded,
  toggleShowApiKey,
  visibleProviders
} = inject(SETTINGS_CONTEXT)
</script>
