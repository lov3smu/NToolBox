<template>
  <div class="split-pane">
    <component :is="viewComponent" v-if="viewComponent" />
    <div v-else class="split-pane-empty">{{ t('该工具不支持分屏') }}</div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, provide } from 'vue'
import { useRouter } from 'vue-router'
import { SPLIT_SECONDARY_KEY } from '@/composables'
import { t } from '@/i18n'

const props = defineProps({
  path: { type: String, default: '' }
})

const emit = defineEmits(['close', 'swap'])

provide(SPLIT_SECONDARY_KEY, {
  swap: () => emit('swap'),
  close: () => emit('close')
})

const router = useRouter()

const viewCache = new Map()

function resolveView(path) {
  const record = router.resolve(path).matched.at(-1)
  const component = record?.components?.default
  if (!component) return null
  if (typeof component !== 'function') return component
  if (!viewCache.has(path)) viewCache.set(path, defineAsyncComponent(component))
  return viewCache.get(path)
}

const viewComponent = computed(() => resolveView(props.path))
</script>

<style scoped>
.split-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-bg);
}

.split-pane-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}
</style>
