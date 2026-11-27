<template>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('代理') }}</h3>
      <span class="setting-section-desc">
        {{ t('所有联网功能（模型对话、扩展市场、类型注册表、更新检查、图床）统一走以下设置') }}
      </span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('连接方式') }}</span>
          <span class="setting-row-desc">{{ t(proxyModeHint) }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="proxyMode" :options="proxyModeOptions" :placeholder="t('选择连接方式')" />
        </div>
      </div>
      <template v-if="proxyMode === 'manual'">
        <div class="setting-row">
          <div class="setting-row-text">
            <span class="setting-row-label">{{ t('代理地址') }}</span>
            <span class="setting-row-desc">
              {{ t('支持 http:// 、https:// 与 socks5://；代理凭据会以明文保存在本地 config.json') }}
            </span>
          </div>
          <div class="setting-row-control">
            <AppInput v-model="proxyUrl" type="text" placeholder="http://127.0.0.1:7890" spellcheck="false" />
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-row-text">
            <span class="setting-row-label">{{ t('忽略代理的地址') }}</span>
            <span class="setting-row-desc">
              {{ t('&lt;local&gt; 表示本机地址；多条规则用逗号或空格分隔，例如 &lt;local&gt; 10.0.0.0/8,*.corp') }}
            </span>
          </div>
          <div class="setting-row-control">
            <AppInput v-model="proxyBypass" type="text" spellcheck="false" />
          </div>
        </div>
      </template>
      <div class="setting-row is-top">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('连通性测试') }}</span>
          <span class="setting-row-desc">{{ t('按当前设置发起一次请求，验证代理是否生效') }}</span>
        </div>
        <div class="setting-row-control">
          <div class="path-input-group">
            <AppInput v-model="networkTestUrl" type="text" placeholder="https://example.com" spellcheck="false" />
            <button class="btn btn-secondary" :disabled="networkTesting" @click="runNetworkTest">
              {{ networkTesting ? t('测试中...') : t('测试') }}
            </button>
          </div>
          <div v-if="networkTestResult" class="api-test-result" :class="networkTestResult.ok ? 'success' : 'error'">
            {{ networkTestResult.message }}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('自定义源') }}</h3>
      <span class="setting-section-desc">{{ t('留空使用官方默认地址；适合需要镜像或内网代理的场景') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('ClawHub 地址') }}</span>
          <span class="setting-row-desc">{{ t('扩展市场技能来源，默认 https://clawhub.ai') }}</span>
        </div>
        <div class="setting-row-control">
          <AppInput v-model="marketSources.clawhub" type="text" placeholder="https://clawhub.ai" spellcheck="false" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('MCP 类型注册表') }}</span>
          <span class="setting-row-desc">{{ t('默认 https://registry.modelcontextprotocol.io/v0') }}</span>
        </div>
        <div class="setting-row-control">
          <AppInput
            v-model="marketSources.mcp_registry"
            type="text"
            placeholder="https://registry.modelcontextprotocol.io/v0"
            spellcheck="false"
          />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('更新源') }}</span>
          <span class="setting-row-desc">{{ t('历史版本列表的 GitHub Releases API 地址') }}</span>
        </div>
        <div class="setting-row-control">
          <AppInput
            v-model="marketSources.update_feed"
            type="text"
            :placeholder="defaultUpdateFeed"
            spellcheck="false"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { inject } from 'vue'
import { t } from '@/i18n'
import SettingSelect from '@/components/settings/SettingSelect.vue'
import { SETTINGS_CONTEXT } from '../settingsContext'
import AppInput from '@/components/AppInput.vue'

const {
  defaultUpdateFeed,
  marketSources,
  networkTestResult,
  networkTestUrl,
  networkTesting,
  proxyBypass,
  proxyMode,
  proxyModeHint,
  proxyModeOptions,
  proxyUrl,
  runNetworkTest
} = inject(SETTINGS_CONTEXT)
</script>
