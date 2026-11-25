import { ref, watch } from 'vue'
import router from '@/router'
import { canSendResourceTo, normalizeSendResource } from '@shared/sendTo'

const pending = ref(null)

export const draggingKind = ref(null)

router.afterEach((to) => {
  if (pending.value && to.path !== pending.value.targetPath) pending.value = null
})

export function sendResourceTo(resource, targetPath) {
  const normalized = normalizeSendResource(resource)
  if (!normalized || !canSendResourceTo(targetPath, normalized.kind)) return false
  pending.value = {
    resource: normalized,
    targetPath,
    token: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  if (router.currentRoute.value.path !== targetPath) router.push(targetPath)
  return true
}

export function takeSendResource(targetPath) {
  const entry = pending.value
  if (!entry || entry.targetPath !== targetPath) return null
  pending.value = null
  return entry.resource
}

export function useSendReceiver(targetPath, ready, handler) {
  watch(
    ready,
    (value) => {
      if (!value) return
      const resource = takeSendResource(targetPath)
      if (resource) handler(resource)
    },
    { immediate: true }
  )
}

export function startResourceDrag(resource) {
  const normalized = normalizeSendResource(resource)
  draggingKind.value = normalized ? normalized.kind : null
  return normalized
}

export function endResourceDrag() {
  draggingKind.value = null
}
