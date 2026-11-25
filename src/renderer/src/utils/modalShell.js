const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const stack = []
let previousOverflow = ''

function focusables(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node === document.activeElement
  )
}

function onKeydown(event) {
  const record = stack[stack.length - 1]
  if (!record) return
  if (event.key === 'Escape' && record.closeOnEsc) {
    event.preventDefault()
    event.stopPropagation()
    record.onClose?.()
    return
  }
  if (event.key !== 'Tab' || !record.node) return
  const items = focusables(record.node)
  if (!items.length) {
    event.preventDefault()
    record.node.focus({ preventScroll: true })
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || !record.node.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function onPointerDown(event) {
  const record = stack[stack.length - 1]
  if (!record || !record.closeOnOutside) return
  if (record.node?.contains(event.target)) return
  record.onClose?.()
}

function teardown() {
  document.removeEventListener('keydown', onKeydown, true)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.body.style.overflow = previousOverflow
  previousOverflow = ''
}

/**
 * Activates modal semantics on an overlay element: aria attributes, scroll lock,
 * Escape / outside dismissal, focus trap and focus restore. Returns a cleanup.
 */
export function activateModal(overlay, { onClose, closeOnEsc = true, closeOnOutside = true, dialog } = {}) {
  if (!overlay) return () => {}
  const node = dialog || overlay.querySelector('[role="dialog"], .message-dialog, .dialog') || overlay.firstElementChild
  const record = {
    overlay,
    node,
    onClose,
    closeOnEsc,
    closeOnOutside,
    restore: document.activeElement
  }
  if (node) {
    if (!node.hasAttribute('role')) node.setAttribute('role', 'dialog')
    node.setAttribute('aria-modal', 'true')
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
  }
  if (!stack.length) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeydown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
  }
  stack.push(record)
  if (node && !node.contains(document.activeElement)) node.focus({ preventScroll: true })
  return () => deactivate(record)
}

const directiveCleanups = new WeakMap()

export const modalShellDirective = {
  mounted(el, binding) {
    const value = binding.value
    const options = typeof value === 'function' ? { onClose: value } : value || {}
    directiveCleanups.set(el, activateModal(el, options))
  },
  beforeUnmount(el) {
    directiveCleanups.get(el)?.()
    directiveCleanups.delete(el)
  }
}

function deactivate(record) {
  const index = stack.indexOf(record)
  if (index === -1) return
  stack.splice(index, 1)
  if (!stack.length) teardown()
  const restore = record.restore
  if (restore && typeof restore.focus === 'function' && restore.isConnected) {
    restore.focus({ preventScroll: true })
  }
}
