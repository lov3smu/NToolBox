<template>
  <div
    class="split-handle"
    :class="[orientation === 'vertical' ? 'is-vertical' : 'is-horizontal', { 'is-resizing': resizing }]"
    role="separator"
    :aria-orientation="orientation"
    :aria-label="label"
    tabindex="0"
  />
</template>

<script setup>
defineProps({
  orientation: {
    type: String,
    default: 'vertical'
  },
  resizing: Boolean,
  label: {
    type: String,
    default: '拖动调整分栏大小'
  }
})
</script>

<style scoped>
.split-handle {
  position: relative;
  flex: 0 0 auto;
  z-index: 5;
  touch-action: none;
  outline: none;
}

.split-handle.is-vertical {
  width: 10px;
  cursor: col-resize;
}

.split-handle.is-horizontal {
  height: 10px;
  cursor: row-resize;
}

.split-handle::before {
  content: '';
  position: absolute;
  border-radius: 2px;
  background: var(--border-color);
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.split-handle.is-vertical::before {
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
}

.split-handle.is-horizontal::before {
  left: 0;
  right: 0;
  top: 4px;
  height: 2px;
}

.split-handle:hover::before,
.split-handle:focus-visible::before,
.split-handle.is-resizing::before {
  background: var(--accent-color);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-color) 35%, transparent);
}
</style>
