<template>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('主题') }}</h3>
    </div>
    <div class="setting-section-body">
      <div class="setting-row is-block">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('主题模式') }}</span>
          <span class="setting-row-desc">{{ t('选择“跟随系统”时，会随操作系统的深色/浅色设置自动切换') }}</span>
        </div>
        <div class="setting-row-control">
          <div class="theme-options">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="theme-option"
              :class="{ active: theme === option.value }"
              @click="selectTheme(option.value)"
            >
              <span class="theme-preview" :class="`theme-preview-${option.value}`">
                <span class="preview-sidebar" />
                <span class="preview-body">
                  <span class="preview-bar" />
                  <span class="preview-line" />
                  <span class="preview-line preview-line-short" />
                </span>
              </span>
              <span class="theme-label">{{ t(option.label) }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="setting-row is-block">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('主题配色') }}</span>
          <span class="setting-row-desc">{{ t('配色会同时作用于按钮、文字和背景，并自动适配明暗模式') }}</span>
        </div>
        <div class="setting-row-control">
          <div class="palette-options">
            <button
              v-for="option in themeStyleOptions"
              :key="option.value"
              type="button"
              class="theme-option palette-option"
              :class="{ active: themeStyle === option.value }"
              @click="selectThemeStyle(option.value)"
            >
              <span class="palette-preview" :style="swatchStyle(option.swatch)">
                <span class="palette-sidebar" />
                <span class="palette-body">
                  <span class="palette-bar" />
                  <span class="palette-accent" />
                </span>
              </span>
              <span class="theme-label">{{ t(option.label) }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('显示') }}</h3>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('字体大小') }}</span>
          <span class="setting-row-desc">{{ t('调整界面与内容区文字大小，图标和控件尺寸保持不变') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            :model-value="fontSize"
            :options="fontSizeOptions"
            :placeholder="t('选择字号')"
            @update:model-value="selectFontSize"
          />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('最近使用工具数') }}</span>
          <span class="setting-row-desc">{{ t('首页「最近使用」区域展示的工具数量') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="recentToolsLimit" :options="recentToolsLimitOptions" :placeholder="t('选择数量')" />
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
  fontSize,
  fontSizeOptions,
  recentToolsLimit,
  recentToolsLimitOptions,
  selectFontSize,
  selectTheme,
  selectThemeStyle,
  swatchStyle,
  theme,
  themeOptions,
  themeStyle,
  themeStyleOptions
} = inject(SETTINGS_CONTEXT)
</script>
