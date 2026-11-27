const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'

function collectItems(panel) {
  if (!panel) return []
  const items = Array.from(panel.querySelectorAll(ITEM_SELECTOR))
  for (const item of items) {
    if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '-1')
  }
  return items
}

export function focusFirstMenuItem(panel) {
  const [first] = collectItems(panel)
  first?.focus()
}

export function handleMenuKeydown(event, panel, close) {
  const items = collectItems(panel)
  if (!items.length) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close?.()
    return
  }
  if (event.key === 'Tab') {
    close?.()
    return
  }
  const index = items.indexOf(document.activeElement)
  let next = null
  if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length
  else if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  if (next === null) return
  event.preventDefault()
  items[next].focus()
}
