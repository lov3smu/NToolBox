<template>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('查询与分页') }}</h3>
      <span class="setting-section-desc">{{ t('打开表数据与保留查询历史时的默认行为') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('默认分页大小') }}</span>
          <span class="setting-row-desc">{{ t('打开表数据时每页加载的行数，可在标签页内临时调整') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="databasePageSize" :options="databasePageSizeOptions" :placeholder="t('选择行数')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('查询历史条数') }}</span>
          <span class="setting-row-desc">{{ t('本地保留的查询历史条数，超出后自动清理最早的记录') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="databaseHistoryLimit"
            :options="databaseHistoryLimitOptions"
            :placeholder="t('选择条数')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('刷新与传输') }}</h3>
      <span class="setting-section-desc">{{ t('实例状态轮询与数据传输的默认参数') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('自动刷新间隔') }}</span>
          <span class="setting-row-desc">{{ t('实例状态与会话面板的轮询间隔，选择「关闭」仅手动刷新') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="databaseRefreshInterval"
            :options="databaseRefreshIntervalOptions"
            :placeholder="t('选择间隔')"
          />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('默认批量大小') }}</span>
          <span class="setting-row-desc">{{ t('数据传输时每批读取与写入的行数，可在传输对话框中临时调整') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="databaseTransferBatchSize"
            :options="databaseTransferBatchSizeOptions"
            :placeholder="t('选择批量')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('安全与审计') }}</h3>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('安全模式') }}</span>
          <span class="setting-row-desc">{{ t('拦截 UPDATE、DELETE 等高风险语句，避免误操作') }}</span>
        </div>
        <div class="setting-row-control">
          <input v-model="databaseSafeMode" type="checkbox" class="switch" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('SQL 审计') }}</span>
          <span class="setting-row-desc">{{ t('执行前按规则检查脚本，提示潜在风险') }}</span>
        </div>
        <div class="setting-row-control">
          <input v-model="databaseAuditEnabled" type="checkbox" class="switch" />
        </div>
      </div>
      <div v-if="databaseAuditEnabled" class="audit-rule-list">
        <label v-for="rule in sqlAuditRules" :key="rule.id" class="audit-rule-item">
          <span class="audit-rule-text">
            <span class="audit-rule-head">
              <span class="audit-rule-name">{{ t(rule.label) }}</span>
              <span class="audit-rule-level" :class="rule.level">
                {{ rule.level === 'error' ? t('拦截级') : t('提示级') }}
              </span>
            </span>
            <span class="audit-rule-desc">{{ t(rule.description) }}</span>
          </span>
          <input v-model="databaseAuditRules[rule.id]" type="checkbox" class="switch" />
        </label>
        <label class="audit-rule-item audit-rule-strict">
          <span class="audit-rule-text">
            <span class="audit-rule-head">
              <span class="audit-rule-name">{{ t('严格模式') }}</span>
            </span>
            <span class="audit-rule-desc">{{ t('出现拦截级问题时禁止执行，只能返回修改') }}</span>
          </span>
          <input v-model="databaseAuditStrict" type="checkbox" class="switch" />
        </label>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('操作日志') }}</span>
          <span class="setting-row-desc">{{ t('记录数据库中的建表、改表与数据变更操作') }}</span>
        </div>
        <div class="setting-row-control">
          <input v-model="databaseOperationLogEnabled" type="checkbox" class="switch" />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('编辑器') }}</h3>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('编辑器主题') }}</span>
          <span class="setting-row-desc">{{ t('SQL 编辑器的配色方案') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="databaseEditor.theme"
            :options="databaseEditorThemes"
            :placeholder="t('选择编辑器主题')"
          />
        </div>
      </div>
      <div v-for="option in databaseEditorOptions" :key="option.key" class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t(option.label) }}</span>
          <span class="setting-row-desc">{{ t(option.description) }}</span>
        </div>
        <div class="setting-row-control">
          <input v-model="databaseEditor[option.key]" type="checkbox" class="switch" />
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

const {
  databaseAuditEnabled,
  databaseAuditRules,
  databaseAuditStrict,
  databaseEditor,
  databaseEditorOptions,
  databaseEditorThemes,
  databaseHistoryLimit,
  databaseHistoryLimitOptions,
  databaseOperationLogEnabled,
  databasePageSize,
  databasePageSizeOptions,
  databaseRefreshInterval,
  databaseRefreshIntervalOptions,
  databaseSafeMode,
  databaseTransferBatchSize,
  databaseTransferBatchSizeOptions,
  sqlAuditRules
} = inject(SETTINGS_CONTEXT)
</script>
