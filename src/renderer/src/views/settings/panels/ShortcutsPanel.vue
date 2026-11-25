<template>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('快捷键配置') }}</h3>
      <span class="setting-section-desc">{{ t('点击修改录制新的快捷键组合，清除后不设置快捷键') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="shortcut-list">
        <div v-for="tool in shortcutTools" :key="tool.path" class="shortcut-item">
          <span class="shortcut-name">{{ t(tool.name) }}</span>
          <div class="shortcut-control">
            <span class="shortcut-value" :class="{ 'is-empty': !shortcuts[tool.shortcutKey] }">
              {{ shortcuts[tool.shortcutKey] ? shortcutLabel(shortcuts[tool.shortcutKey]) : t('未设置') }}
            </span>
            <button
              type="button"
              class="btn-icon btn-sm"
              :title="t('修改')"
              :aria-label="t('修改')"
              @click="openShortcutEditor(tool.shortcutKey, t(tool.name))"
            >
              <AppIcon name="pencil" />
            </button>
            <button
              type="button"
              class="btn-icon btn-sm"
              :title="canRestoreShortcut(tool.shortcutKey) ? t('恢复默认') : t('清除')"
              :aria-label="canRestoreShortcut(tool.shortcutKey) ? t('恢复默认') : t('清除')"
              :disabled="!shortcuts[tool.shortcutKey] && !canRestoreShortcut(tool.shortcutKey)"
              @click="
                canRestoreShortcut(tool.shortcutKey)
                  ? restoreShortcut(tool.shortcutKey)
                  : clearShortcut(tool.shortcutKey)
              "
            >
              <AppIcon :name="canRestoreShortcut(tool.shortcutKey) ? 'rotate-ccw' : 'erase'" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('通用快捷键') }}</h3>
      <span class="setting-section-desc">{{ t('作用于聊天输入框、数据库查询与全局搜索，清除后恢复默认值') }}</span>
    </div>
    <div class="setting-section-body">
      <div v-for="item in shortcutActionItems" :key="item.key" class="setting-row is-top">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t(item.label) }}</span>
          <span class="setting-row-desc">{{ t(item.desc) }}</span>
        </div>
        <div class="setting-row-control shortcut-control">
          <span class="shortcut-value" :class="{ 'is-empty': !shortcuts[item.key] }">
            {{
              shortcuts[item.key]
                ? shortcutLabel(shortcuts[item.key])
                : t('默认：{shortcut}', { shortcut: item.placeholder })
            }}
          </span>
          <button
            type="button"
            class="btn-icon btn-sm"
            :title="t('修改')"
            :aria-label="t('修改')"
            @click="openShortcutEditor(item.key, t(item.label), DEFAULT_SHORTCUT_ACTIONS[item.key])"
          >
            <AppIcon name="pencil" />
          </button>
          <button
            type="button"
            class="btn-icon btn-sm"
            :title="canRestoreShortcut(item.key) ? t('恢复默认') : t('清除')"
            :aria-label="canRestoreShortcut(item.key) ? t('恢复默认') : t('清除')"
            :disabled="!shortcuts[item.key] && !canRestoreShortcut(item.key)"
            @click="canRestoreShortcut(item.key) ? restoreShortcut(item.key) : clearShortcut(item.key)"
          >
            <AppIcon :name="canRestoreShortcut(item.key) ? 'rotate-ccw' : 'erase'" />
          </button>
        </div>
      </div>
    </div>
  </section>

  <ShortcutRecorderDialog
    :visible="shortcutEditor.visible"
    :name="shortcutEditor.name"
    :accelerator="shortcuts[shortcutEditor.key] || ''"
    :fallback="shortcutEditor.fallback"
    :is-mac="isMac"
    @cancel="closeShortcutEditor"
    @save="saveShortcut"
  />
</template>

<script setup>
import { inject } from 'vue'
import { t } from '@/i18n'
import ShortcutRecorderDialog from '@/components/ShortcutRecorderDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { SETTINGS_CONTEXT } from '../settingsContext'

const {
  DEFAULT_SHORTCUT_ACTIONS,
  canRestoreShortcut,
  clearShortcut,
  closeShortcutEditor,
  isMac,
  openShortcutEditor,
  restoreShortcut,
  saveShortcut,
  shortcutActionItems,
  shortcutEditor,
  shortcutLabel,
  shortcutTools,
  shortcuts
} = inject(SETTINGS_CONTEXT)
</script>
