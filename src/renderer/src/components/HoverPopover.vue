<template>
  <span
    ref="anchorRef"
    class="hover-popover-anchor"
    :class="{ 'is-inline': inline }"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onFocusIn"
    @focusout="onLeave"
  >
    <slot />
    <Teleport to="body">
      <Transition name="hover-popover">
        <div
          v-if="open"
          ref="cardRef"
          class="hover-popover"
          :class="`is-${sizeClass}`"
          role="tooltip"
          :style="cardStyle"
          @mouseenter="cancelHide"
          @mouseleave="onLeave"
        >
          <slot name="content" />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  size: { type: String, default: 'md' },
  delay: { type: Number, default: 320 },
  hideDelay: { type: Number, default: 140 },
  focusDelay: { type: Number, default: 120 },
  offset: { type: Number, default: 8 },
  placement: { type: String, default: 'bottom' },
  boundary: { type: String, default: '' },
  inline: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const anchorRef = ref(null)
const cardRef = ref(null)
const open = ref(false)
const cardStyle = ref({})
let showTimer = null
let hideTimer = null

function onEnter() {
  cancelHide()
  if (open.value || props.disabled) return
  scheduleShow(props.delay)
}

function onFocusIn() {
  if (props.disabled) return
  scheduleShow(props.focusDelay)
}

function onLeave() {
  clearTimeout(showTimer)
  cancelHide()
  hideTimer = setTimeout(() => {
    open.value = false
    cardStyle.value = {}
  }, props.hideDelay)
}

function scheduleShow(delay) {
  clearTimeout(showTimer)
  showTimer = setTimeout(() => {
    open.value = true
    nextTick(place)
  }, delay)
}

function cancelHide() {
  clearTimeout(hideTimer)
  hideTimer = null
}

const SIDES = ['top', 'bottom', 'left', 'right']
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

function parsePlacement(value) {
  const [sideRaw, alignRaw] = String(value || 'bottom').split('-')
  const side = SIDES.includes(sideRaw) ? sideRaw : 'bottom'
  const align = ['start', 'center', 'end'].includes(alignRaw) ? alignRaw : 'start'
  return { side, align }
}

function computePosition(side, align, rect, cardWidth, cardHeight, gap) {
  const vertical = side === 'top' || side === 'bottom'
  let top
  let left
  if (vertical) {
    top = side === 'bottom' ? rect.bottom + gap : rect.top - gap - cardHeight
    if (align === 'center') left = rect.left + (rect.width - cardWidth) / 2
    else if (align === 'end') left = rect.right - cardWidth
    else left = rect.left
  } else {
    left = side === 'right' ? rect.right + gap : rect.left - gap - cardWidth
    if (align === 'center') top = rect.top + (rect.height - cardHeight) / 2
    else if (align === 'end') top = rect.bottom - cardHeight
    else top = rect.top
  }
  return { top, left }
}

function fitsViewport(pos, cardWidth, cardHeight, margin) {
  return (
    pos.top >= margin &&
    pos.left >= margin &&
    pos.top + cardHeight <= window.innerHeight - margin &&
    pos.left + cardWidth <= window.innerWidth - margin
  )
}

async function place() {
  await nextTick()
  const anchor = anchorRef.value
  const card = cardRef.value
  if (!anchor || !card) return
  card.style.maxWidth = ''
  const rect = anchor.getBoundingClientRect()
  const gap = props.offset
  const margin = 8
  const { side, align } = parsePlacement(props.placement)

  const boundaryEl = props.boundary ? anchor.closest(props.boundary) : null
  if (boundaryEl && side === 'right') {
    // Keep the card fully outside the boundary (e.g. the session rail) instead of flipping over it
    const minLeft = boundaryEl.getBoundingClientRect().right + gap
    const available = Math.max(0, window.innerWidth - margin - minLeft)
    let cardRect = card.getBoundingClientRect()
    if (cardRect.width > available) {
      card.style.maxWidth = `${Math.round(available)}px`
      cardRect = card.getBoundingClientRect()
    }
    const { top } = computePosition(side, align, rect, cardRect.width, cardRect.height, gap)
    const maxTop = Math.max(margin, window.innerHeight - margin - cardRect.height)
    cardStyle.value = {
      top: `${Math.round(Math.min(Math.max(top, margin), maxTop))}px`,
      left: `${Math.round(Math.max(margin, minLeft))}px`
    }
    return
  }

  const cardRect = card.getBoundingClientRect()
  const width = cardRect.width
  const height = cardRect.height
  let pos = computePosition(side, align, rect, width, height, gap)
  if (!fitsViewport(pos, width, height, margin)) {
    const flipped = computePosition(OPPOSITE[side], align, rect, width, height, gap)
    if (fitsViewport(flipped, width, height, margin)) pos = flipped
  }
  const maxLeft = Math.max(margin, window.innerWidth - margin - width)
  const maxTop = Math.max(margin, window.innerHeight - margin - height)
  const top = Math.min(Math.max(pos.top, margin), maxTop)
  const left = Math.min(Math.max(pos.left, margin), maxLeft)
  cardStyle.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

const onScroll = (event) => {
  const target = event.target
  if (target && target.nodeType && cardRef.value?.contains(target)) return
  open.value = false
  cardStyle.value = {}
}

const onKeydown = (event) => {
  if (event.key === 'Escape') onScroll()
}

watch(open, (value) => {
  if (value) {
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
    window.removeEventListener('keydown', onKeydown)
  }
})

watch(
  () => props.disabled,
  (value) => {
    if (!value) return
    clearTimeout(showTimer)
    clearTimeout(hideTimer)
    open.value = false
    cardStyle.value = {}
  }
)

onBeforeUnmount(() => {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.hover-popover-anchor {
  display: block;
  min-width: 0;
}

.hover-popover-anchor.is-inline {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.hover-popover {
  position: fixed;
  z-index: 1200;
  width: max-content;
  max-width: 320px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.hover-popover.is-xl {
  max-width: 384px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.hover-popover.is-lg {
  max-width: 352px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.hover-popover.is-sm {
  max-width: 288px;
  padding: 8px 10px;
}

.hover-popover.is-xs {
  max-width: 240px;
  padding: 6px 8px;
}

.hover-popover-enter-active,
.hover-popover-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.hover-popover-enter-from,
.hover-popover-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .hover-popover-enter-active,
  .hover-popover-leave-active {
    transition: none;
  }
}
</style>
