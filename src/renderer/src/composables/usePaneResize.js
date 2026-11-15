import { onUnmounted, ref } from 'vue'

const ARROW_STEP = 16
const ARROW_STEP_LARGE = 48
const ARROW_STEP_PERCENT = 2

function readStoredSize(key) {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  const stored = Number(raw)
  return Number.isFinite(stored) ? stored : null
}

export function usePaneResize(options) {
  const {
    key,
    initial,
    min = 0,
    max = Number.POSITIVE_INFINITY,
    unit = 'px',
    direction = 'horizontal',
    container
  } = options

  const resolveValue = (value) => (typeof value === 'function' ? value() : value)
  const getDirection = () => resolveValue(direction)
  const getContainer = () => (typeof container === 'function' ? container() : (container?.value ?? container))

  function clamp(value) {
    return Math.min(Math.max(value, resolveValue(min)), resolveValue(max))
  }

  const stored = readStoredSize(key)
  const initialValue = resolveValue(initial)
  const size = ref(stored === null ? clamp(initialValue) : clamp(stored))
  const resizing = ref(false)

  let stopDrag = null

  function persist() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(size.value))
    }
  }

  function stop() {
    if (stopDrag) {
      stopDrag()
      stopDrag = null
    }
  }

  function startResize(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    stop()

    const axis = getDirection()
    let containerSize = 0

    if (unit === 'percent') {
      const containerElement = getContainer()
      if (!containerElement) return
      const rect = containerElement.getBoundingClientRect()
      containerSize = axis === 'horizontal' ? rect.width : rect.height
      if (containerSize <= 0) return
    }

    event.preventDefault()

    const startPosition = axis === 'horizontal' ? event.clientX : event.clientY
    const startSize = size.value
    const cursor = axis === 'horizontal' ? 'col-resize' : 'row-resize'

    resizing.value = true
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'

    const handleMove = (moveEvent) => {
      const current = axis === 'horizontal' ? moveEvent.clientX : moveEvent.clientY
      const delta = current - startPosition
      const next = unit === 'percent' ? startSize + (delta / containerSize) * 100 : startSize + delta
      size.value = Math.round(clamp(next) * 10) / 10
    }

    const handleEnd = () => {
      stop()
      persist()
    }

    stopDrag = () => {
      resizing.value = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
  }

  function onKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return

    const axis = getDirection()
    const step = unit === 'percent' ? ARROW_STEP_PERCENT : event.shiftKey ? ARROW_STEP_LARGE : ARROW_STEP
    let delta = 0

    if (axis === 'horizontal') {
      if (event.key === 'ArrowLeft') delta = -step
      else if (event.key === 'ArrowRight') delta = step
    } else if (event.key === 'ArrowUp') delta = -step
    else if (event.key === 'ArrowDown') delta = step

    if (!delta) return

    event.preventDefault()
    size.value = Math.round(clamp(size.value + delta) * 10) / 10
    persist()
  }

  onUnmounted(stop)

  return {
    size,
    resizing,
    startResize,
    onKeydown
  }
}
