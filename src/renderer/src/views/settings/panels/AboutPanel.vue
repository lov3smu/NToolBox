<template>
  <div class="about-section">
    <div class="about-icon">
      <img :src="iconUrl" alt="NToolBox Logo" />
    </div>
    <div class="about-name">NToolBox</div>
    <div class="about-version">{{ t('版本: {version}', { version }) }}</div>
    <div class="about-description">
      {{ t('一款面向开发人员的多端工具集合平台，集成丰富工具 + AI大模型能力，启动快、功能全、更智能。') }}
    </div>
    <div class="about-author">{{ t('作者: {author}', { author }) }}</div>
    <div class="about-copyright">{{ year }} {{ author }}. All rights reserved.</div>
    <div class="about-buttons">
      <button class="btn btn-secondary" @click="checkUpdate">{{ t('检查更新') }}</button>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { t } from '@/i18n'
import iconUrl from '@assets/icon.png'
import { SETTINGS_CONTEXT } from '../settingsContext'

const { author, checkUpdate, version, year } = inject(SETTINGS_CONTEXT)
</script>
