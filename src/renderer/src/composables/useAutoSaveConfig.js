import { t } from '@/i18n'

const TEXT_INPUT_EXCLUDED_TYPES = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color']

function isTextEditing() {
  const el = document.activeElement
  if (!el) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  return !TEXT_INPUT_EXCLUDED_TYPES.includes(el.type)
}

export function useAutoSaveConfig({ getKind, buildPayload, getError, save, onSaved, showError, delay = 400 }) {
  let ready = false
  let timer = null
  let chain = Promise.resolve()
  const lastSavedStates = {}

  function enqueue(task) {
    chain = chain.then(task, task)
    return chain
  }

  function schedule() {
    if (!ready || !getKind()) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (isTextEditing()) return
      void flush(false)
    }, delay)
  }

  function onFocusOut(event) {
    const target = event.target
    if (!target?.closest) return
    if (target.closest('.provider-card')) return
    void flush(true)
  }

  function flush(force = false, kind = getKind()) {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!ready || !kind) return Promise.resolve(true)

    return enqueue(async () => {
      const payload = buildPayload(kind)
      if (!payload) return true
      const state = JSON.stringify(payload)
      if (lastSavedStates[kind] === state) return true

      const error = getError(kind)
      if (error) {
        if (force) showError(error)
        return false
      }

      try {
        const success = await save(payload)
        if (!success) {
          if (force) showError(t('保存失败，请检查配置'))
          return false
        }
        lastSavedStates[kind] = state
        await onSaved?.(kind, payload)
        return true
      } catch (e) {
        if (force) showError(t('保存失败: ') + e.message)
        return false
      }
    })
  }

  function markReady() {
    ready = true
  }

  function isReady() {
    return ready
  }

  function seedSavedStates(kinds) {
    for (const kind of kinds) lastSavedStates[kind] = JSON.stringify(buildPayload(kind))
  }

  function rememberSaved(kind) {
    lastSavedStates[kind] = JSON.stringify(buildPayload(kind))
  }

  return { schedule, flush, onFocusOut, enqueue, markReady, isReady, seedSavedStates, rememberSaved }
}
