<template>
  <div ref="barRef" class="tab-bar" :class="`is-${sizeClass}`" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :data-key="tab.key"
      type="button"
      role="tab"
      class="tab-bar-item"
      :class="{ active: tab.key === modelValue }"
      :aria-selected="tab.key === modelValue"
      :tabindex="tab.key === modelValue ? 0 : -1"
      @click="select(tab.key)"
      @keydown="onKeydown($event, tab.key)"
    >
      {{ tab.label }}
    </button>
    <span class="tab-bar-indicator" :style="indicatorStyle" aria-hidden="true" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  modelValue: { type: String, required: true },
  tabs: { type: Array, required: true },
  size: { type: String, default: 'md' },
  ariaLabel: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const barRef = ref(null)
const indicatorStyle = ref({ width: '0px', transform: 'translateX(0)', opacity: 0 })
let observer = null

function updateIndicator() {
  const bar = barRef.value
  const active = bar?.querySelector('.tab-bar-item.active')
  if (!bar || !active) return
  indicatorStyle.value = {
    width: `${active.offsetWidth}px`,
    transform: `translateX(${active.offsetLeft}px)`,
    opacity: 1
  }
}

function select(key) {
  if (key !== props.modelValue) emit('update:modelValue', key)
}

function onKeydown(event, key) {
  const keys = props.tabs.map((tab) => tab.key)
  const index = keys.indexOf(key)
  let target = null
  if (event.key === 'ArrowRight') target = keys[(index + 1) % keys.length]
  else if (event.key === 'ArrowLeft') target = keys[(index - 1 + keys.length) % keys.length]
  else if (event.key === 'Home') target = keys[0]
  else if (event.key === 'End') target = keys[keys.length - 1]
  if (!target || target === key) return
  event.preventDefault()
  emit('update:modelValue', target)
  nextTick(() => barRef.value?.querySelector(`[data-key="${target}"]`)?.focus())
}

onMounted(() => {
  updateIndicator()
  const ResizeObserverImpl = globalThis.ResizeObserver
  if (typeof ResizeObserverImpl === 'undefined' || !barRef.value) return
  observer = new ResizeObserverImpl(updateIndicator)
  observer.observe(barRef.value)
  barRef.value.querySelectorAll('.tab-bar-item').forEach((item) => observer.observe(item))
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(
  () => props.modelValue,
  () => nextTick(updateIndicator)
)

watch(
  () => props.tabs.map((tab) => tab.label).join('|'),
  () => nextTick(updateIndicator)
)
</script>

<style scoped>
.tab-bar {
  --tab-height: 30px;
  --tab-padding: 12px;
  --tab-font: var(--font-size-sm);
  --tab-indicator: 2px;
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  height: var(--tab-height);
  flex-shrink: 0;
}

.tab-bar.is-xl {
  --tab-height: var(--control-height-xl);
  --tab-padding: 18px;
  --tab-font: var(--font-size-base);
  --tab-indicator: 3px;
}

.tab-bar.is-lg {
  --tab-height: var(--control-height-lg);
  --tab-padding: 15px;
  --tab-font: var(--font-size-base);
}

.tab-bar.is-sm {
  --tab-height: var(--control-height-sm);
  --tab-padding: 10px;
}

.tab-bar.is-xs {
  --tab-height: var(--control-height-xs);
  --tab-padding: 8px;
  --tab-font: var(--font-size-xs);
}

.tab-bar-item {
  height: var(--tab-height);
  padding: 0 var(--tab-padding);
  border: none;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--tab-font);
  cursor: pointer;
  white-space: nowrap;
  transition:
    color var(--motion-fast) var(--motion-ease),
    background var(--motion-fast) var(--motion-ease);
}

.tab-bar-item:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.tab-bar-item.active {
  color: var(--accent-color);
  font-weight: 600;
}

.tab-bar-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.tab-bar-indicator {
  position: absolute;
  left: 0;
  bottom: 0;
  height: var(--tab-indicator);
  border-radius: var(--radius-xs);
  background: var(--accent-color);
  pointer-events: none;
  transition:
    transform var(--motion-base) var(--motion-ease),
    width var(--motion-base) var(--motion-ease),
    opacity var(--motion-fast) var(--motion-ease);
}
</style>
