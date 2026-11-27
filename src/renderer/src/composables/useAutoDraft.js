import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { draftList, draftSave } from '@/api'

const DRAFT_ID = 'current'

export function useAutoDraft(kind, content, { delay = 500, onRestore } = {}) {
  const savedAt = ref(0)
  const ready = ref(false)
  let timer = null
  let active = true

  const savedTime = computed(() => {
    if (!savedAt.value) return ''
    return new Date(savedAt.value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  })

  async function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!ready.value) return
    try {
      const result = await draftSave(kind, { id: DRAFT_ID, content: content.value })
      if (result?.success && active) savedAt.value = Date.now()
    } catch {
      // 保存失败不打断编辑，内容仍在当前页面
    }
  }

  watch(content, () => {
    if (!ready.value) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, delay)
  })

  onMounted(async () => {
    try {
      const page = await draftList(kind, { limit: 1 })
      const draft = page?.items?.[0]
      if (draft && typeof draft.content === 'string') {
        content.value = draft.content
        await nextTick()
        onRestore?.(draft.content)
      }
    } catch {
      // 读取失败时保留页面默认内容
    }
    ready.value = true
  })

  onUnmounted(() => {
    active = false
    void flush()
  })

  return { savedAt, savedTime, ready, flush }
}
