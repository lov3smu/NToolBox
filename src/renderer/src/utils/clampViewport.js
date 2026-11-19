const DEFAULT_MARGIN = 8

export function clampToViewport(el, margin = DEFAULT_MARGIN) {
  if (!el || !el.isConnected) return
  el.style.translate = ''
  el.style.maxHeight = ''
  el.style.maxWidth = ''
  el.classList.remove('is-clamped-x', 'is-clamped-y')
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxWidth = Math.max(0, viewportWidth - margin * 2)
  const maxHeight = Math.max(0, viewportHeight - margin * 2)
  let rect = el.getBoundingClientRect()
  if (rect.height > maxHeight) {
    el.style.maxHeight = `${Math.round(maxHeight)}px`
    el.style.overflowY = 'auto'
    rect = el.getBoundingClientRect()
  }
  if (rect.width > maxWidth) {
    el.style.maxWidth = `${Math.round(maxWidth)}px`
    rect = el.getBoundingClientRect()
  }
  let dx = 0
  let dy = 0
  if (rect.right > viewportWidth - margin) dx = viewportWidth - margin - rect.right
  if (rect.left + dx < margin) dx = margin - rect.left
  if (rect.bottom > viewportHeight - margin) dy = viewportHeight - margin - rect.bottom
  if (rect.top + dy < margin) dy = margin - rect.top
  if (dx || dy) el.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`
  if (dx < 0) el.classList.add('is-clamped-x')
  if (dy < 0) el.classList.add('is-clamped-y')
}

function run(el) {
  if (!el || !el.isConnected) return
  clampToViewport(el, el.__clampMargin)
}

export const clampViewportDirective = {
  mounted(el, binding) {
    el.__clampMargin = Number(binding.value) > 0 ? Number(binding.value) : DEFAULT_MARGIN
    el.__clampHandler = () => run(el)
    run(el)
    window.requestAnimationFrame(el.__clampHandler)
    el.__clampTimer = window.setTimeout(el.__clampHandler, 120)
    window.addEventListener('resize', el.__clampHandler)
  },
  updated(el) {
    window.requestAnimationFrame(() => run(el))
  },
  unmounted(el) {
    if (el.__clampTimer) window.clearTimeout(el.__clampTimer)
    if (el.__clampHandler) window.removeEventListener('resize', el.__clampHandler)
  }
}
