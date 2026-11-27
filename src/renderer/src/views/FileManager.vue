<template>
  <PageLayout tool-path="/file-manager">
    <FileExplorer
      variant="page"
      :root-path="basePath"
      system-open
      image-drag
      :open-file-on-click="false"
      :unset-description="t('请到设置中设置脚本根目录后再使用文件管理。')"
    />
  </PageLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useConfig } from '@/composables'
import PageLayout from '@/layouts/PageLayout.vue'
import FileExplorer from '@/components/FileExplorer.vue'
import { t } from '@/i18n'

const { config } = useConfig()

const basePath = computed(() => config.value?.sql_generator.base_path || '')
</script>
