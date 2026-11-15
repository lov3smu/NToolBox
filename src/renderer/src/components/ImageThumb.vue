<template>
  <button
    ref="rootRef"
    type="button"
    class="thumb-item"
    :class="{ active }"
    :title="file.name"
    :aria-label="file.name"
    @click="$emit('select')"
  >
    <span class="thumb-preview">
      <img v-if="src" :src="src" alt="" draggable="false" />
      <svg v-else class="thumb-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </span>
    <span class="thumb-name">{{ file.name }}</span>
  </button>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { imageRead, imageThumbnail } from '@/api'

const props = defineProps({
  file: { type: Object, required: true },
  active: Boolean
})

defineEmits(['select'])

const rootRef = ref(null)
const src = ref('')
let observer = null
let blobUrl = ''
let started = false

async function load() {
  if (started) return
  started = true

  try {
    const res = await imageThumbnail(props.file.path)
    if (res?.success && res.dataUrl) {
      src.value = res.dataUrl
      return
    }
  } catch {
    // 缩略图生成失败时回退到原图
  }

  try {
    const res = await imageRead(props.file.path)
    if (!res?.success) return
    blobUrl = URL.createObjectURL(new Blob([res.data], { type: res.mime }))
    src.value = blobUrl
  } catch {
    // 忽略无法读取的图片
  }
}

onMounted(() => {
  const ObserverImpl = globalThis.IntersectionObserver
  if (typeof ObserverImpl === 'undefined') {
    load()
    return
  }

  observer = new ObserverImpl(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer?.disconnect()
        observer = null
        load()
      }
    },
    { rootMargin: '120px' }
  )
  observer.observe(rootRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (blobUrl) URL.revokeObjectURL(blobUrl)
})
</script>

<style scoped>
.thumb-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.thumb-item:hover {
  background: var(--surface-hover);
}

.thumb-item.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--text-primary);
}

.thumb-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 5px;
  overflow: hidden;
  background: var(--surface-muted);
}

.thumb-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumb-placeholder {
  width: 22px;
  height: 22px;
  color: var(--text-tertiary);
}

.thumb-name {
  padding: 0 2px;
  font-size: var(--font-size-xs);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
